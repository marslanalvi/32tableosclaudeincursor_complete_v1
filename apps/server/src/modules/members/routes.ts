import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import { generateUuidV7 } from "@tabula/types";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { ApiError, handleRouteError } from "../../http/errors.js";
import { writeAuditEvent } from "../audit/write.js";
import { invalidateBaseSnapshotCache, invalidateUserSnapshotCache } from "../access/compile.js";
import {
  ORG_ROLES,
  canManageMember,
  getOrgRole,
  isOrgManagerRole,
  type OrgRole,
} from "../access/workspace-access.js";
import { grantCeiling, roleRank } from "../access/delegation.js";
import { requestMayAccess } from "../../kernel/request-context.js";
import { allowedDomainsOf } from "../auth/signup-policy.js";
import {
  DEVICE_COOKIE,
  deviceLabel,
  hashDeviceKey,
  invalidateDeviceCache,
  requiresDeviceApproval,
} from "../access/devices.js";
import { TOKEN_SCOPES, generateApiToken } from "../access/api-tokens.js";

/**
 * Access administration for Owners and Admins: who is in the organization, what role they
 * have on each workspace/base, until when, from which approved devices, plus API tokens.
 * Owners manage everyone; Admins manage Members, and only on workspaces and bases where they
 * are Creator themselves. Only Owners change account types. Members get 403 here.
 */

const WORKSPACE_GRANT_ROLES = ["owner", "creator", "editor", "commenter", "viewer"] as const;
/** `none` blocks a base that the member's workspace role would otherwise open. */
const BASE_GRANT_ROLES = ["creator", "editor", "commenter", "viewer", "none"] as const;

const grantBody = z
  .object({
    workspaceId: z.string().optional(),
    baseId: z.string().optional(),
    /** null removes the grant. */
    role: z.string().nullable(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((b) => Boolean(b.workspaceId) !== Boolean(b.baseId), { message: "Provide exactly one of workspaceId or baseId" });

const memberPatch = z.object({ status: z.enum(["active", "suspended"]) });
const rolePatch = z.object({ role: z.enum(ORG_ROLES as [OrgRole, ...OrgRole[]]) });
const transferBody = z.object({ userId: z.string() });
const devicePatch = z.object({ status: z.enum(["approved", "revoked"]).optional(), label: z.string().trim().max(100).optional() });
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const settingsPatch = z.object({
  requireDeviceApproval: z.boolean().optional(),
  allowedSignupDomains: z
    .array(z.string().trim().toLowerCase().transform((d) => d.replace(/^@/, "")).pipe(z.string().regex(DOMAIN_RE, "Not a valid email domain")))
    .max(50)
    .optional(),
});
const tokenBody = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(TOKEN_SCOPES as [string, ...string[]])).min(1),
  /** Omit or null = every base in the organization. */
  baseIds: z.array(z.string()).min(1).max(200).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

type OrgParams = { orgId: string };

/** Activity log filters: the first part of the audit action. */
const ACTIVITY_CATEGORIES = ["auth", "member", "access", "invite", "device", "api_token", "org", "base", "share", "automation"];

export async function registerMembersRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  function wrap<P>(fn: (request: FastifyRequest<{ Params: P }>, reply: FastifyReply) => Promise<void>) {
    return async (request: FastifyRequest<{ Params: P }>, reply: FastifyReply) => {
      try {
        await fn(request, reply);
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    };
  }

  function me(request: FastifyRequest) {
    if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in first");
    if (request.apiTokenId) throw new ApiError(403, "FORBIDDEN", "API tokens can't manage access");
    return request.user;
  }

  type Actor = { userId: string; orgId: string; role: OrgRole };

  async function managerOrg(request: FastifyRequest<{ Params: OrgParams }>): Promise<Actor> {
    const user = me(request);
    const orgId = parsePid(request.params.orgId, "org");
    const role = requestMayAccess(orgId) ? await getOrgRole(ctx.db, user.id, orgId) : null;
    if (!role || !isOrgManagerRole(role)) {
      throw new ApiError(403, "FORBIDDEN", "Only Owners and Admins can manage access");
    }
    return { userId: user.id, orgId, role };
  }

  async function ownerOrg(request: FastifyRequest<{ Params: OrgParams }>): Promise<Actor> {
    const actor = await managerOrg(request);
    if (actor.role !== "owner") throw new ApiError(403, "FORBIDDEN", "Only Owners can change account types or ownership");
    return actor;
  }

  async function activeOwnerCount(orgId: string): Promise<number> {
    const r = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core.organization_members WHERE org_id = ${orgId} AND role = 'owner' AND status = 'active'
    `.execute(ctx.db);
    return r.rows[0]?.n ?? 0;
  }

  /** Admins approve, revoke and forget Members' devices only, never their own. */
  async function assertDeviceManageable(actor: Actor, deviceId: string) {
    const r = await sql<{ user_id: string; role: string | null }>`
      SELECT d.user_id, m.role FROM core.org_devices d
      LEFT JOIN core.organization_members m ON m.org_id = d.org_id AND m.user_id = d.user_id
      WHERE d.id = ${deviceId} AND d.org_id = ${actor.orgId}
    `.execute(ctx.db);
    const d = r.rows[0];
    if (!d) throw new ApiError(404, "NOT_FOUND", "Device not found");
    if (!canManageMember(actor.role, d.role ?? "member", d.user_id === actor.userId)) {
      throw new ApiError(403, "FORBIDDEN", "Only Owners decide on the devices of Owners and Admins, and nobody approves their own");
    }
  }

  /** Everything cached about one person's access, after their org role or status changed. */
  async function refreshPerson(orgId: string, userId: string) {
    await bumpBases(await orgBaseIds(orgId));
    invalidateUserSnapshotCache(userId);
    invalidateDeviceCache(userId);
  }

  async function bumpBases(baseIds: string[]) {
    if (baseIds.length === 0) return;
    await sql`
      UPDATE data.base_runtime SET perm_epoch = perm_epoch + 1, updated_at = now()
      WHERE base_id = ANY(${baseIds}::uuid[])
    `.execute(ctx.db);
    for (const b of baseIds) invalidateBaseSnapshotCache(b);
  }

  async function orgBaseIds(orgId: string): Promise<string[]> {
    const r = await sql<{ base_id: string }>`
      SELECT base_id FROM core.base_directory WHERE org_id = ${orgId} AND deleted_at IS NULL
    `.execute(ctx.db);
    return r.rows.map((x) => x.base_id);
  }

  /** The person being changed; Admins may only change Members, nobody changes themselves. */
  async function targetMember(actor: Actor, userPid: string) {
    const userId = parsePid(userPid, "usr");
    const r = await sql<{ role: string; status: string }>`
      SELECT role, status FROM core.organization_members
      WHERE org_id = ${actor.orgId} AND user_id = ${userId} AND status <> 'deactivated'
    `.execute(ctx.db);
    const m = r.rows[0];
    if (!m) throw new ApiError(404, "NOT_FOUND", "Member not found");
    if (userId === actor.userId) throw new ApiError(409, "CONFLICT", "You can't change your own access here");
    if (!canManageMember(actor.role, m.role, false)) {
      throw new ApiError(403, "FORBIDDEN", "Only Owners can change the access of Owners and Admins");
    }
    return { userId, ...m };
  }

  /** Organizations I belong to, so the UI knows where I'm the owner. */
  app.get(
    "/v1/orgs",
    wrap(async (request, reply) => {
      const user = me(request);
      const r = await sql<{ id: string; name: string; role: string }>`
        SELECT o.id, o.name, m.role
        FROM core.organization_members m INNER JOIN core.organizations o ON o.id = m.org_id AND o.status = 'active'
        WHERE m.user_id = ${user.id} AND m.status = 'active'
        ORDER BY (m.role = 'owner') DESC, o.created_at
      `.execute(ctx.db);
      void reply.send({
        orgs: r.rows.map((o) => ({
          id: pid("org", o.id),
          name: o.name,
          role: o.role,
          isOwner: o.role === "owner",
          /** Owners and Admins open Members & access. */
          canManage: isOrgManagerRole(o.role),
        })),
      });
    }),
  );

  /** Where this browser is still waiting for (or was denied) approval. */
  app.get(
    "/v1/devices/current",
    wrap(async (request, reply) => {
      const user = me(request);
      const key = request.cookies[DEVICE_COOKIE];
      if (!key) {
        void reply.send({ pending: [] });
        return;
      }
      const r = await sql<{ org_id: string; org_name: string; status: string; label: string; settings: unknown; owner_name: string | null }>`
        SELECT d.org_id, o.name AS org_name, d.status, d.label, o.settings,
               (SELECT u.display_name FROM core.organization_members om JOIN core.users u ON u.id = om.user_id
                 WHERE om.org_id = d.org_id AND om.role = 'owner' AND om.status = 'active' LIMIT 1) AS owner_name
        FROM core.org_devices d
        INNER JOIN core.organizations o ON o.id = d.org_id
        INNER JOIN core.organization_members m ON m.org_id = d.org_id AND m.user_id = d.user_id AND m.status = 'active'
        WHERE d.user_id = ${user.id} AND d.device_hash = ${hashDeviceKey(key)} AND d.status <> 'approved'
          AND m.role <> 'owner'
      `.execute(ctx.db);
      void reply.send({
        pending: r.rows
          .filter((x) => x.status === "revoked" || requiresDeviceApproval(x.settings))
          .map((x) => ({ orgId: pid("org", x.org_id), orgName: x.org_name, status: x.status, label: x.label, ownerName: x.owner_name })),
      });
    }),
  );

  /** Everything the "Members & access" screen needs (Admins: only what they may manage). */
  app.get<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/access",
    wrap<OrgParams>(async (request, reply) => {
      const actor = await managerOrg(request);
      const { orgId } = actor;
      const [org, members, grants, workspaces, bases, devices, invites] = await Promise.all([
        sql<{ name: string; settings: unknown }>`SELECT name, settings FROM core.organizations WHERE id = ${orgId}`.execute(ctx.db),
        sql<{ user_id: string; email: string; display_name: string; role: string; status: string; joined_at: Date | null }>`
          SELECT m.user_id, u.email, u.display_name, m.role, m.status, m.joined_at
          FROM core.organization_members m INNER JOIN core.users u ON u.id = m.user_id
          WHERE m.org_id = ${orgId} AND m.status IN ('active','suspended')
          ORDER BY (m.role = 'owner') DESC, u.display_name
        `.execute(ctx.db),
        sql<{ principal_id: string; resource_type: string; resource_id: string; role: string; expires_at: Date | null }>`
          SELECT principal_id, resource_type, resource_id, role, expires_at
          FROM core.access_grants
          WHERE org_id = ${orgId} AND principal_type = 'user' AND resource_type IN ('workspace','base')
        `.execute(ctx.db),
        sql<{ id: string; name: string }>`
          SELECT id, name FROM core.workspaces WHERE org_id = ${orgId} AND deleted_at IS NULL AND status = 'active' ORDER BY created_at
        `.execute(ctx.db),
        sql<{ base_id: string; workspace_id: string; name: string }>`
          SELECT base_id, workspace_id, name FROM core.base_directory
          WHERE org_id = ${orgId} AND status = 'active' AND deleted_at IS NULL ORDER BY order_key, created_at
        `.execute(ctx.db),
        sql<{ id: string; user_id: string; label: string; user_agent: string | null; last_ip: string | null; status: string; first_seen_at: Date; last_seen_at: Date; decided_at: Date | null }>`
          SELECT id, user_id, label, user_agent, host(last_ip) AS last_ip, status, first_seen_at, last_seen_at, decided_at
          FROM core.org_devices WHERE org_id = ${orgId} ORDER BY last_seen_at DESC
        `.execute(ctx.db),
        sql<{ id: string; email: string; role: string; org_role: string; workspace_id: string | null; base_id: string | null; extra_base_ids: string[] | null; expires_at: Date; created_at: Date }>`
          SELECT id, email, role, org_role, workspace_id, base_id, extra_base_ids, expires_at, created_at FROM core.invitations
          WHERE org_id = ${orgId} AND status = 'pending' AND expires_at > now() ORDER BY created_at DESC
        `.execute(ctx.db),
      ]);
      // Owners see and manage everything. Admins see the workspaces and bases where they may
      // hand out access (Creator or workspace Owner there) and nothing else.
      const wsManage = new Map<string, boolean>();
      const baseManage = new Map<string, boolean>();
      for (const w of workspaces.rows) wsManage.set(w.id, (await grantCeiling(ctx.db, actor.userId, actor.role, { workspaceId: w.id })) > 0);
      for (const b of bases.rows) baseManage.set(b.base_id, (await grantCeiling(ctx.db, actor.userId, actor.role, { baseId: b.base_id })) > 0);
      const visibleBases = bases.rows.filter((b) => baseManage.get(b.base_id));
      const visibleWs = workspaces.rows.filter((w) => wsManage.get(w.id) || visibleBases.some((b) => b.workspace_id === w.id));
      const visibleIds = new Set([...visibleWs.map((w) => w.id), ...visibleBases.map((b) => b.base_id)]);
      const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
      void reply.send({
        org: {
          id: pid("org", orgId),
          name: org.rows[0]?.name ?? "",
          requireDeviceApproval: requiresDeviceApproval(org.rows[0]?.settings),
          allowedSignupDomains: allowedDomainsOf(org.rows[0]?.settings),
        },
        me: { id: pid("usr", actor.userId), role: actor.role },
        workspaces: visibleWs.map((w) => ({
          id: pid("wsp", w.id),
          name: w.name,
          /** False: an Admin may manage some bases here but not the whole workspace. */
          manageable: wsManage.get(w.id) ?? false,
          bases: visibleBases.filter((b) => b.workspace_id === w.id).map((b) => ({ id: pid("bas", b.base_id), name: b.name })),
        })),
        members: members.rows.map((m) => ({
          id: pid("usr", m.user_id),
          email: m.email,
          name: m.display_name,
          orgRole: m.role,
          isOwner: m.role === "owner",
          isMe: m.user_id === actor.userId,
          /** Whether I may change this person's access, suspend or remove them. */
          canManage: canManageMember(actor.role, m.role, m.user_id === actor.userId),
          status: m.status,
          joinedAt: iso(m.joined_at),
          grants: grants.rows
            .filter((g) => g.principal_id === m.user_id && visibleIds.has(g.resource_id))
            .map((g) => ({
              resourceType: g.resource_type,
              resourceId: pid(g.resource_type === "workspace" ? "wsp" : "bas", g.resource_id),
              role: g.role,
              expiresAt: iso(g.expires_at),
              expired: g.expires_at ? new Date(g.expires_at) < new Date() : false,
            })),
          /** Access in workspaces and bases the viewer doesn't manage (not listed above, but real). */
          otherGrantCount: grants.rows.filter((g) => g.principal_id === m.user_id && !visibleIds.has(g.resource_id)).length,
          /** Your own row: everything you were given, by name. */
          ...(m.user_id === actor.userId
            ? {
                ownAccess: grants.rows
                  .filter((g) => g.principal_id === m.user_id)
                  .map((g) => ({
                    resourceType: g.resource_type,
                    name:
                      g.resource_type === "workspace"
                        ? (workspaces.rows.find((w) => w.id === g.resource_id)?.name ?? "a workspace")
                        : (bases.rows.find((b) => b.base_id === g.resource_id)?.name ?? "a base"),
                    role: g.role,
                  })),
              }
            : {}),
          devices: devices.rows
            .filter((d) => d.user_id === m.user_id)
            .map((d) => ({
              id: pid("dev", d.id),
              label: d.label,
              userAgent: d.user_agent,
              lastIp: d.last_ip,
              status: d.status,
              firstSeenAt: iso(d.first_seen_at),
              lastSeenAt: iso(d.last_seen_at),
              decidedAt: iso(d.decided_at),
            })),
        })),
        invitations: invites.rows
          .filter((i) =>
            actor.role === "owner" ||
            (i.org_role === "member" &&
              (i.base_id ? [i.base_id, ...(i.extra_base_ids ?? [])].every((b) => visibleIds.has(b)) : Boolean(i.workspace_id && wsManage.get(i.workspace_id)))),
          )
          .map((i) => ({
          id: pid("inv", i.id),
          email: i.email,
          role: i.role,
          orgRole: i.org_role,
          workspaceId: i.workspace_id && !i.base_id ? pid("wsp", i.workspace_id) : null,
          baseId: i.base_id ? pid("bas", i.base_id) : null,
          baseIds: i.base_id ? [i.base_id, ...(i.extra_base_ids ?? [])].map((b) => pid("bas", b)) : [],
          expiresAt: iso(i.expires_at),
        })),
        pendingDevices: devices.rows.filter((d) => {
          if (d.status !== "pending") return false;
          const owner = members.rows.find((m) => m.user_id === d.user_id);
          return Boolean(owner && canManageMember(actor.role, owner.role, owner.user_id === actor.userId));
        }).length,
      });
    }),
  );

  /**
   * Devices log, per person: devices by state (waiting, approved, revoked) with who decided,
   * sign-in sessions (active and ended) and the history of approvals and revocations.
   */
  app.get<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/device-log",
    wrap<OrgParams>(async (request, reply) => {
      const { orgId } = await managerOrg(request);
      const [members, devices, sessions, events] = await Promise.all([
        sql<{ user_id: string; email: string; display_name: string; role: string; status: string }>`
          SELECT m.user_id, u.email, u.display_name, m.role, m.status
          FROM core.organization_members m INNER JOIN core.users u ON u.id = m.user_id
          WHERE m.org_id = ${orgId} AND m.status IN ('active','suspended')
          ORDER BY (m.role = 'owner') DESC, u.display_name
        `.execute(ctx.db),
        sql<{ id: string; user_id: string; label: string; user_agent: string | null; first_ip: string | null; last_ip: string | null; status: string; first_seen_at: Date; last_seen_at: Date; decided_at: Date | null; decided_by_name: string | null }>`
          SELECT d.id, d.user_id, d.label, d.user_agent, host(d.first_ip) AS first_ip, host(d.last_ip) AS last_ip, d.status,
                 d.first_seen_at, d.last_seen_at, d.decided_at, nullif(u.display_name, '') AS decided_by_name
          FROM core.org_devices d LEFT JOIN core.users u ON u.id = d.decided_by
          WHERE d.org_id = ${orgId} ORDER BY d.last_seen_at DESC
        `.execute(ctx.db),
        sql<{ id: string; user_id: string; ip: string | null; user_agent: string | null; created_at: Date; last_seen_at: Date; revoked_at: Date | null; active: boolean }>`
          SELECT id, user_id, ip, user_agent, created_at, last_seen_at, revoked_at, active FROM (
            SELECT s.id, s.user_id, host(s.ip) AS ip, s.user_agent, s.created_at, s.last_seen_at, s.revoked_at,
                   (s.revoked_at IS NULL AND s.expires_at > now() AND s.idle_expires_at > now()) AS active,
                   row_number() OVER (PARTITION BY s.user_id ORDER BY s.last_seen_at DESC) AS n
            FROM core.sessions s
            WHERE s.auth_method <> 'automation'
              AND s.user_id IN (SELECT user_id FROM core.organization_members WHERE org_id = ${orgId})
          ) x WHERE n <= 30
        `.execute(ctx.db),
        sql<{ action: string; target_id: string | null; metadata: Record<string, unknown> | null; created_at: Date; actor_name: string | null }>`
          SELECT e.action, e.target_id, e.metadata, e.created_at, nullif(u.display_name, '') AS actor_name
          FROM audit.audit_events e LEFT JOIN core.users u ON u.id = e.actor_user_id
          WHERE e.org_id = ${orgId} AND e.action IN ('device.approved', 'device.revoked', 'device.deleted')
          ORDER BY e.created_at DESC LIMIT 1000
        `.execute(ctx.db),
      ]);
      const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
      const deviceById = new Map(devices.rows.map((d) => [d.id, d]));
      void reply.send({
        members: members.rows.map((m) => {
          const own = devices.rows.filter((d) => d.user_id === m.user_id);
          const ownIds = new Set(own.map((d) => d.id));
          const history = [
            ...own.map((d) => ({ kind: "requested" as const, at: iso(d.first_seen_at)!, deviceId: pid("dev", d.id), deviceLabel: d.label, by: null as string | null, ip: d.first_ip })),
            ...events.rows
              .filter((e) => (e.target_id && ownIds.has(e.target_id)) || e.metadata?.["userId"] === m.user_id)
              .map((e) => ({
                kind: e.action === "device.approved" ? ("approved" as const) : e.action === "device.revoked" ? ("revoked" as const) : ("forgotten" as const),
                at: iso(e.created_at)!,
                deviceId: e.target_id ? pid("dev", e.target_id) : null,
                deviceLabel: (e.target_id && deviceById.get(e.target_id)?.label) || "a device",
                by: e.actor_name,
                ip: null as string | null,
              })),
          ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
          return {
            id: pid("usr", m.user_id),
            email: m.email,
            name: m.display_name,
            isOwner: m.role === "owner",
            status: m.status,
            devices: own.map((d) => ({
              id: pid("dev", d.id),
              label: d.label,
              userAgent: d.user_agent,
              firstIp: d.first_ip,
              lastIp: d.last_ip,
              status: d.status,
              firstSeenAt: iso(d.first_seen_at),
              lastSeenAt: iso(d.last_seen_at),
              decidedAt: iso(d.decided_at),
              decidedBy: d.decided_by_name,
            })),
            sessions: sessions.rows
              .filter((x) => x.user_id === m.user_id)
              .map((x) => ({
                id: x.id,
                label: deviceLabel(x.user_agent),
                ip: x.ip,
                startedAt: iso(x.created_at),
                lastSeenAt: iso(x.last_seen_at),
                endedAt: iso(x.revoked_at),
                active: x.active,
              })),
            history: history.slice(0, 100),
          };
        }),
      });
    }),
  );

  app.patch<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/settings",
    wrap<OrgParams>(async (request, reply) => {
      const { userId, orgId } = await managerOrg(request);
      const body = settingsPatch.parse(request.body);
      if (body.requireDeviceApproval !== undefined) {
        await sql`
          UPDATE core.organizations
          SET settings = jsonb_set(settings, '{security}', coalesce(settings->'security', '{}'::jsonb) || ${JSON.stringify({ requireDeviceApproval: body.requireDeviceApproval })}::jsonb),
              updated_at = now()
          WHERE id = ${orgId}
        `.execute(ctx.db);
        invalidateDeviceCache();
      }
      if (body.allowedSignupDomains !== undefined) {
        const domains = [...new Set(body.allowedSignupDomains)];
        await sql`
          UPDATE core.organizations
          SET settings = jsonb_set(settings, '{signup}', coalesce(settings->'signup', '{}'::jsonb) || ${JSON.stringify({ allowedDomains: domains })}::jsonb),
              updated_at = now()
          WHERE id = ${orgId}
        `.execute(ctx.db);
      }
      await writeAuditEvent(ctx.db, { orgId, actorUserId: userId, action: "org.security_updated", targetType: "organization", targetId: orgId, metadata: body, ip: request.ip });
      const after = await sql<{ settings: unknown }>`SELECT settings FROM core.organizations WHERE id = ${orgId}`.execute(ctx.db);
      void reply.send({
        requireDeviceApproval: requiresDeviceApproval(after.rows[0]?.settings),
        allowedSignupDomains: allowedDomainsOf(after.rows[0]?.settings),
      });
    }),
  );

  /** Set (or with role=null remove) a member's role on one workspace or base, optionally until a date. */
  app.put<{ Params: OrgParams & { userId: string } }>(
    "/v1/orgs/:orgId/members/:userId/grants",
    wrap<OrgParams & { userId: string }>(async (request, reply) => {
      const who = await managerOrg(request);
      const { userId: actor, orgId } = who;
      const target = await targetMember(who, request.params.userId);
      const body = grantBody.parse(request.body);
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (expiresAt && expiresAt <= new Date()) throw new ApiError(422, "VALIDATION_FAILED", "Access end date must be in the future");

      let resourceType: "workspace" | "base";
      let resourceId: string;
      let workspaceId: string;
      let baseId: string | null = null;
      let affected: string[];
      if (body.baseId) {
        resourceType = "base";
        resourceId = parsePid(body.baseId, "bas");
        const d = await sql<{ workspace_id: string }>`
          SELECT workspace_id FROM core.base_directory WHERE base_id = ${resourceId} AND org_id = ${orgId} AND deleted_at IS NULL
        `.execute(ctx.db);
        if (!d.rows[0]) throw new ApiError(404, "NOT_FOUND", "Base not found in this organization");
        workspaceId = d.rows[0].workspace_id;
        baseId = resourceId;
        affected = [resourceId];
        if (body.role !== null && !(BASE_GRANT_ROLES as readonly string[]).includes(body.role)) {
          throw new ApiError(422, "VALIDATION_FAILED", `Base roles are ${BASE_GRANT_ROLES.join(", ")}`);
        }
      } else {
        resourceType = "workspace";
        resourceId = parsePid(body.workspaceId!, "wsp");
        const w = await sql<{ id: string }>`
          SELECT id FROM core.workspaces WHERE id = ${resourceId} AND org_id = ${orgId} AND deleted_at IS NULL
        `.execute(ctx.db);
        if (!w.rows[0]) throw new ApiError(404, "NOT_FOUND", "Workspace not found in this organization");
        workspaceId = resourceId;
        const b = await sql<{ base_id: string }>`SELECT base_id FROM core.base_directory WHERE workspace_id = ${resourceId}`.execute(ctx.db);
        affected = b.rows.map((x) => x.base_id);
        if (body.role !== null && !(WORKSPACE_GRANT_ROLES as readonly string[]).includes(body.role)) {
          throw new ApiError(422, "VALIDATION_FAILED", `Workspace roles are ${WORKSPACE_GRANT_ROLES.join(", ")}`);
        }
      }

      // Admins: only where they are Creator themselves, never above their own role, and they
      // can't take away a role higher than their own.
      const existing = await sql<{ role: string }>`
        SELECT role FROM core.access_grants
        WHERE principal_type = 'user' AND principal_id = ${target.userId}
          AND resource_type = ${resourceType} AND resource_id = ${resourceId}
      `.execute(ctx.db);
      const ceiling = await grantCeiling(ctx.db, actor, who.role, baseId ? { baseId } : { workspaceId });
      const needed = Math.max(1, roleRank(resourceType, body.role), ...existing.rows.map((g) => roleRank(resourceType, g.role)));
      if (ceiling < needed) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Admins can only give access where they are Creator themselves, and not above their own role",
        );
      }

      await ctx.db.transaction().execute(async (trx) => {
        await sql`
          DELETE FROM core.access_grants
          WHERE principal_type = 'user' AND principal_id = ${target.userId}
            AND resource_type = ${resourceType} AND resource_id = ${resourceId}
        `.execute(trx);
        if (body.role !== null) {
          await sql`
            INSERT INTO core.access_grants (
              id, org_id, resource_type, resource_id, workspace_id, base_id,
              principal_type, principal_id, role, source, granted_by, expires_at
            ) VALUES (
              ${generateUuidV7()}, ${orgId}, ${resourceType}, ${resourceId}, ${workspaceId}, ${baseId},
              'user', ${target.userId}, ${body.role}, 'manual', ${actor}, ${expiresAt}
            )
          `.execute(trx);
        }
      });
      await bumpBases(affected);
      invalidateUserSnapshotCache(target.userId);
      await writeAuditEvent(ctx.db, {
        orgId,
        workspaceId,
        actorUserId: actor,
        action: body.role === null ? "access.revoked" : "access.granted",
        targetType: "user",
        targetId: target.userId,
        metadata: { resourceType, resourceId, role: body.role, expiresAt: body.expiresAt ?? null },
        ip: request.ip,
      });
      void reply.send({ ok: true });
    }),
  );

  /** Suspend (blocks all access, keeps roles) or reactivate a member. */
  app.patch<{ Params: OrgParams & { userId: string } }>(
    "/v1/orgs/:orgId/members/:userId",
    wrap<OrgParams & { userId: string }>(async (request, reply) => {
      const who = await managerOrg(request);
      const { userId: actor, orgId } = who;
      const target = await targetMember(who, request.params.userId);
      const body = memberPatch.parse(request.body);
      await sql`
        UPDATE core.organization_members SET status = ${body.status}, updated_at = now()
        WHERE org_id = ${orgId} AND user_id = ${target.userId}
      `.execute(ctx.db);
      await bumpBases(await orgBaseIds(orgId));
      invalidateUserSnapshotCache(target.userId);
      invalidateDeviceCache(target.userId);
      await writeAuditEvent(ctx.db, { orgId, actorUserId: actor, action: `member.${body.status === "active" ? "reactivated" : "suspended"}`, targetType: "user", targetId: target.userId, ip: request.ip });
      void reply.send({ status: body.status });
    }),
  );

  /** Remove someone from the organization: every role and device here is deleted. */
  app.delete<{ Params: OrgParams & { userId: string } }>(
    "/v1/orgs/:orgId/members/:userId",
    wrap<OrgParams & { userId: string }>(async (request, reply) => {
      const who = await managerOrg(request);
      const { userId: actor, orgId } = who;
      const target = await targetMember(who, request.params.userId);
      await ctx.db.transaction().execute(async (trx) => {
        await sql`DELETE FROM core.access_grants WHERE org_id = ${orgId} AND principal_type = 'user' AND principal_id = ${target.userId}`.execute(trx);
        await sql`DELETE FROM core.org_devices WHERE org_id = ${orgId} AND user_id = ${target.userId}`.execute(trx);
        await sql`
          UPDATE core.organization_members SET status = 'deactivated', updated_at = now()
          WHERE org_id = ${orgId} AND user_id = ${target.userId}
        `.execute(trx);
      });
      await bumpBases(await orgBaseIds(orgId));
      invalidateUserSnapshotCache(target.userId);
      invalidateDeviceCache(target.userId);
      await writeAuditEvent(ctx.db, { orgId, actorUserId: actor, action: "member.removed", targetType: "user", targetId: target.userId, ip: request.ip });
      void reply.code(204).send();
    }),
  );

  /**
   * Account type (Owner, Admin, Member). Only Owners change it (questionnaire B14). An Owner
   * may step down when another active Owner remains.
   */
  app.put<{ Params: OrgParams & { userId: string } }>(
    "/v1/orgs/:orgId/members/:userId/role",
    wrap<OrgParams & { userId: string }>(async (request, reply) => {
      const actor = await ownerOrg(request);
      const userId = parsePid(request.params.userId, "usr");
      const { role } = rolePatch.parse(request.body);
      const cur = await sql<{ role: string; status: string }>`
        SELECT role, status FROM core.organization_members
        WHERE org_id = ${actor.orgId} AND user_id = ${userId} AND status <> 'deactivated'
      `.execute(ctx.db);
      const m = cur.rows[0];
      if (!m) throw new ApiError(404, "NOT_FOUND", "Member not found");
      if (m.role === role) {
        void reply.send({ role });
        return;
      }
      if (m.role === "owner" && m.status === "active" && (await activeOwnerCount(actor.orgId)) <= 1) {
        throw new ApiError(409, "CONFLICT", "The organization needs at least one Owner. Make someone else Owner first.");
      }
      if (role === "owner" && m.status !== "active") {
        throw new ApiError(409, "CONFLICT", "Reactivate this person before making them Owner");
      }
      await sql`
        UPDATE core.organization_members SET role = ${role}, updated_at = now()
        WHERE org_id = ${actor.orgId} AND user_id = ${userId}
      `.execute(ctx.db);
      await refreshPerson(actor.orgId, userId);
      await writeAuditEvent(ctx.db, {
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action: "member.role_changed",
        targetType: "user",
        targetId: userId,
        metadata: { from: m.role, to: role },
        ip: request.ip,
      });
      void reply.send({ role });
    }),
  );

  /** Hand ownership to someone: they become Owner, you become Admin (questionnaire B2). */
  app.post<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/transfer-ownership",
    wrap<OrgParams>(async (request, reply) => {
      const actor = await ownerOrg(request);
      const userId = parsePid(transferBody.parse(request.body).userId, "usr");
      if (userId === actor.userId) throw new ApiError(409, "CONFLICT", "You already own this organization");
      const t = await sql<{ status: string }>`
        SELECT status FROM core.organization_members WHERE org_id = ${actor.orgId} AND user_id = ${userId}
      `.execute(ctx.db);
      if (t.rows[0]?.status !== "active") throw new ApiError(404, "NOT_FOUND", "Active member not found");
      await ctx.db.transaction().execute(async (trx) => {
        await sql`UPDATE core.organization_members SET role = 'owner', updated_at = now() WHERE org_id = ${actor.orgId} AND user_id = ${userId}`.execute(trx);
        await sql`UPDATE core.organization_members SET role = 'admin', updated_at = now() WHERE org_id = ${actor.orgId} AND user_id = ${actor.userId}`.execute(trx);
      });
      await refreshPerson(actor.orgId, userId);
      await refreshPerson(actor.orgId, actor.userId);
      await writeAuditEvent(ctx.db, {
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action: "org.ownership_transferred",
        targetType: "user",
        targetId: userId,
        ip: request.ip,
      });
      void reply.send({ ok: true });
    }),
  );

  app.patch<{ Params: OrgParams & { deviceId: string } }>(
    "/v1/orgs/:orgId/devices/:deviceId",
    wrap<OrgParams & { deviceId: string }>(async (request, reply) => {
      const who = await managerOrg(request);
      const { userId: actor, orgId } = who;
      const body = devicePatch.parse(request.body);
      const id = parsePid(request.params.deviceId, "dev");
      await assertDeviceManageable(who, id);
      const r = await sql<{ user_id: string; status: string }>`
        UPDATE core.org_devices
        SET status = coalesce(${body.status ?? null}, status),
            label = coalesce(${body.label ?? null}, label),
            decided_by = CASE WHEN ${body.status ?? null}::text IS NULL THEN decided_by ELSE ${actor}::uuid END,
            decided_at = CASE WHEN ${body.status ?? null}::text IS NULL THEN decided_at ELSE now() END
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING user_id, status
      `.execute(ctx.db);
      const row = r.rows[0];
      if (!row) throw new ApiError(404, "NOT_FOUND", "Device not found");
      invalidateDeviceCache(row.user_id);
      if (body.status) {
        await writeAuditEvent(ctx.db, { orgId, actorUserId: actor, action: `device.${body.status}`, targetType: "device", targetId: id, metadata: { userId: row.user_id }, ip: request.ip });
      }
      void reply.send({ status: row.status });
    }),
  );

  app.delete<{ Params: OrgParams & { deviceId: string } }>(
    "/v1/orgs/:orgId/devices/:deviceId",
    wrap<OrgParams & { deviceId: string }>(async (request, reply) => {
      const who = await managerOrg(request);
      const { userId: actor, orgId } = who;
      const id = parsePid(request.params.deviceId, "dev");
      await assertDeviceManageable(who, id);
      const r = await sql<{ user_id: string }>`DELETE FROM core.org_devices WHERE id = ${id} AND org_id = ${orgId} RETURNING user_id`.execute(ctx.db);
      if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Device not found");
      invalidateDeviceCache(r.rows[0].user_id);
      await writeAuditEvent(ctx.db, { orgId, actorUserId: actor, action: "device.deleted", targetType: "device", targetId: id, metadata: { userId: r.rows[0].user_id }, ip: request.ip });
      void reply.code(204).send();
    }),
  );

  /* --------------------------- Activity log --------------------------- */

  /**
   * Who did what in the organization (questionnaire G20): sign-ins, people, roles, invitations,
   * devices, tokens, security, workspaces and bases, share links and automations. Newest first,
   * 100 per page (`before` = createdAt of the last row).
   */
  app.get<{ Params: OrgParams; Querystring: { before?: string; category?: string } }>(
    "/v1/orgs/:orgId/activity",
    wrap<OrgParams>(async (request, reply) => {
      const { orgId } = await managerOrg(request);
      const q = request.query as { before?: string; category?: string };
      const before = q.before && !Number.isNaN(Date.parse(q.before)) ? new Date(q.before) : null;
      const prefix = q.category && ACTIVITY_CATEGORIES.includes(q.category) ? `${q.category}.%` : null;
      const r = await sql<{
        id: string;
        action: string;
        target_type: string | null;
        target_id: string | null;
        metadata: Record<string, unknown> | null;
        ip: string | null;
        created_at: Date;
        actor_name: string | null;
        actor_email: string | null;
        target_label: string | null;
      }>`
        SELECT e.id, e.action, e.target_type, e.target_id::text AS target_id, e.metadata, host(e.ip) AS ip, e.created_at,
               nullif(a.display_name, '') AS actor_name, a.email AS actor_email,
               CASE e.target_type
                 WHEN 'user' THEN (SELECT coalesce(nullif(u.display_name, ''), u.email) FROM core.users u WHERE u.id::text = e.target_id)
                 WHEN 'base' THEN (SELECT b.name FROM core.base_directory b WHERE b.base_id::text = e.target_id)
                 WHEN 'workspace' THEN (SELECT w.name FROM core.workspaces w WHERE w.id::text = e.target_id)
                 WHEN 'automation' THEN (SELECT au.name FROM data.automations au WHERE au.id::text = e.target_id)
                 WHEN 'api_token' THEN (SELECT t.name FROM core.api_tokens t WHERE t.id::text = e.target_id)
                 WHEN 'device' THEN (SELECT d.label FROM core.org_devices d WHERE d.id::text = e.target_id)
                 WHEN 'invitation' THEN (SELECT i.email FROM core.invitations i WHERE i.id::text = e.target_id)
                 ELSE NULL END AS target_label
        FROM audit.audit_events e
        LEFT JOIN core.users a ON a.id = e.actor_user_id
        WHERE (e.org_id = ${orgId} OR e.workspace_id IN (SELECT id FROM core.workspaces WHERE org_id = ${orgId}))
          ${before ? sql`AND e.created_at < ${before}` : sql``}
          ${prefix ? sql`AND e.action LIKE ${prefix}` : sql``}
        ORDER BY e.created_at DESC
        LIMIT 101
      `.execute(ctx.db);
      const page = r.rows.slice(0, 100);
      void reply.send({
        events: page.map((e) => ({
          id: e.id,
          action: e.action,
          at: new Date(e.created_at).toISOString(),
          actor: e.actor_email ? { name: e.actor_name ?? e.actor_email, email: e.actor_email } : null,
          targetType: e.target_type,
          target: e.target_label,
          details: e.metadata ?? {},
          ip: e.ip,
        })),
        nextBefore: r.rows.length > 100 ? new Date(page[page.length - 1]!.created_at).toISOString() : null,
      });
    }),
  );

  /* ---------------------------- API tokens ---------------------------- */

  app.get<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/api-tokens",
    wrap<OrgParams>(async (request, reply) => {
      const { orgId, userId, role } = await managerOrg(request);
      // Owners see every token; Admins only their own (a token acts with its creator's access).
      const onlyMine = role !== "owner";
      const r = await sql<{ id: string; name: string; token_prefix: string; scopes: string[]; base_ids: string[] | null; expires_at: Date | null; last_used_at: Date | null; revoked_at: Date | null; created_at: Date; created_by: string | null }>`
        SELECT t.id, t.name, t.token_prefix, t.scopes, t.base_ids, t.expires_at, t.last_used_at, t.revoked_at, t.created_at,
               nullif(u.display_name, '') AS created_by
        FROM core.api_tokens t LEFT JOIN core.users u ON u.id = t.user_id
        WHERE t.org_id = ${orgId} AND (${!onlyMine} OR t.user_id = ${userId})
        ORDER BY t.created_at DESC LIMIT 200
      `.execute(ctx.db);
      const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
      void reply.send({
        tokens: r.rows.map((t) => ({
          id: pid("tok", t.id),
          name: t.name,
          createdBy: t.created_by,
          prefix: t.token_prefix,
          scopes: t.scopes,
          baseIds: t.base_ids ? t.base_ids.map((b) => pid("bas", b)) : null,
          expiresAt: iso(t.expires_at),
          lastUsedAt: iso(t.last_used_at),
          status: t.revoked_at ? "revoked" : t.expires_at && new Date(t.expires_at) < new Date() ? "expired" : "active",
          createdAt: iso(t.created_at),
        })),
      });
    }),
  );

  /** The raw token is returned once; only its hash is stored. */
  app.post<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/api-tokens",
    wrap<OrgParams>(async (request, reply) => {
      const { userId, orgId } = await managerOrg(request);
      const body = tokenBody.parse(request.body);
      let baseIds: string[] | null = null;
      if (body.baseIds) {
        baseIds = body.baseIds.map((b) => parsePid(b, "bas"));
        const ok = await sql<{ n: string }>`
          SELECT count(*) AS n FROM core.base_directory WHERE org_id = ${orgId} AND base_id = ANY(${baseIds}::uuid[]) AND deleted_at IS NULL
        `.execute(ctx.db);
        if (Number(ok.rows[0]?.n ?? 0) !== new Set(baseIds).size) throw new ApiError(422, "VALIDATION_FAILED", "Every base must belong to this organization");
      }
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (expiresAt && expiresAt <= new Date()) throw new ApiError(422, "VALIDATION_FAILED", "Expiry must be in the future");
      const scopes = TOKEN_SCOPES.filter((s) => body.scopes.includes(s));
      const { token, prefix, hash } = generateApiToken();
      const id = generateUuidV7();
      await sql`
        INSERT INTO core.api_tokens (id, org_id, user_id, name, token_prefix, token_hash, scopes, base_ids, expires_at)
        VALUES (${id}, ${orgId}, ${userId}, ${body.name}, ${prefix}, ${hash}, ${scopes}::text[], ${baseIds}::uuid[], ${expiresAt})
      `.execute(ctx.db);
      await writeAuditEvent(ctx.db, { orgId, actorUserId: userId, action: "api_token.created", targetType: "api_token", targetId: id, metadata: { name: body.name, scopes, baseIds: body.baseIds ?? null }, ip: request.ip });
      void reply.code(201).send({
        token,
        apiToken: {
          id: pid("tok", id),
          name: body.name,
          prefix,
          scopes,
          baseIds: body.baseIds ?? null,
          expiresAt: expiresAt?.toISOString() ?? null,
          lastUsedAt: null,
          status: "active",
          createdAt: new Date().toISOString(),
        },
      });
    }),
  );

  app.delete<{ Params: OrgParams & { tokenId: string } }>(
    "/v1/orgs/:orgId/api-tokens/:tokenId",
    wrap<OrgParams & { tokenId: string }>(async (request, reply) => {
      const { userId, orgId, role } = await managerOrg(request);
      const id = parsePid(request.params.tokenId, "tok");
      const r = await sql<{ id: string }>`
        UPDATE core.api_tokens SET revoked_at = coalesce(revoked_at, now())
        WHERE id = ${id} AND org_id = ${orgId} AND (${role === "owner"} OR user_id = ${userId})
        RETURNING id
      `.execute(ctx.db);
      if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Token not found");
      await writeAuditEvent(ctx.db, { orgId, actorUserId: userId, action: "api_token.revoked", targetType: "api_token", targetId: id, ip: request.ip });
      void reply.code(204).send();
    }),
  );
}
