import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import { generateUuidV7 } from "@tabula/types";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { ApiError, handleRouteError } from "../../http/errors.js";
import { writeAuditEvent } from "../audit/write.js";
import { invalidateBaseSnapshotCache, invalidateUserSnapshotCache } from "../access/compile.js";
import { isOrgOwner } from "../access/workspace-access.js";
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
 * Owner-only access administration: who is in the organization, what role they
 * have on each workspace/base, until when, from which approved devices, plus
 * API tokens. Everyone else gets 403 here.
 */

const WORKSPACE_GRANT_ROLES = ["creator", "editor", "commenter", "viewer"] as const;
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

  async function ownerOrg(request: FastifyRequest<{ Params: OrgParams }>): Promise<{ userId: string; orgId: string }> {
    const user = me(request);
    const orgId = parsePid(request.params.orgId, "org");
    if (!(await isOrgOwner(ctx.db, user.id, orgId))) {
      throw new ApiError(403, "FORBIDDEN", "Only the owner can manage access");
    }
    return { userId: user.id, orgId };
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

  async function targetMember(orgId: string, userPid: string) {
    const userId = parsePid(userPid, "usr");
    const r = await sql<{ role: string; status: string }>`
      SELECT role, status FROM core.organization_members WHERE org_id = ${orgId} AND user_id = ${userId}
    `.execute(ctx.db);
    const m = r.rows[0];
    if (!m) throw new ApiError(404, "NOT_FOUND", "Member not found");
    if (m.role === "owner") throw new ApiError(409, "CONFLICT", "The owner's access can't be changed");
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
        orgs: r.rows.map((o) => ({ id: pid("org", o.id), name: o.name, role: o.role, isOwner: o.role === "owner" })),
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

  /** Everything the owner's "Members & access" screen needs. */
  app.get<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/access",
    wrap<OrgParams>(async (request, reply) => {
      const { orgId } = await ownerOrg(request);
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
        sql<{ id: string; email: string; role: string; workspace_id: string | null; base_id: string | null; extra_base_ids: string[] | null; expires_at: Date; created_at: Date }>`
          SELECT id, email, role, workspace_id, base_id, extra_base_ids, expires_at, created_at FROM core.invitations
          WHERE org_id = ${orgId} AND status = 'pending' AND expires_at > now() ORDER BY created_at DESC
        `.execute(ctx.db),
      ]);
      const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
      void reply.send({
        org: {
          id: pid("org", orgId),
          name: org.rows[0]?.name ?? "",
          requireDeviceApproval: requiresDeviceApproval(org.rows[0]?.settings),
          allowedSignupDomains: allowedDomainsOf(org.rows[0]?.settings),
        },
        workspaces: workspaces.rows.map((w) => ({
          id: pid("wsp", w.id),
          name: w.name,
          bases: bases.rows.filter((b) => b.workspace_id === w.id).map((b) => ({ id: pid("bas", b.base_id), name: b.name })),
        })),
        members: members.rows.map((m) => ({
          id: pid("usr", m.user_id),
          email: m.email,
          name: m.display_name,
          orgRole: m.role,
          isOwner: m.role === "owner",
          status: m.status,
          joinedAt: iso(m.joined_at),
          grants: grants.rows
            .filter((g) => g.principal_id === m.user_id)
            .map((g) => ({
              resourceType: g.resource_type,
              resourceId: pid(g.resource_type === "workspace" ? "wsp" : "bas", g.resource_id),
              role: g.role,
              expiresAt: iso(g.expires_at),
              expired: g.expires_at ? new Date(g.expires_at) < new Date() : false,
            })),
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
        invitations: invites.rows.map((i) => ({
          id: pid("inv", i.id),
          email: i.email,
          role: i.role,
          workspaceId: i.workspace_id && !i.base_id ? pid("wsp", i.workspace_id) : null,
          baseId: i.base_id ? pid("bas", i.base_id) : null,
          baseIds: i.base_id ? [i.base_id, ...(i.extra_base_ids ?? [])].map((b) => pid("bas", b)) : [],
          expiresAt: iso(i.expires_at),
        })),
        pendingDevices: devices.rows.filter((d) => d.status === "pending").length,
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
      const { orgId } = await ownerOrg(request);
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
      const { userId, orgId } = await ownerOrg(request);
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
      const { userId: actor, orgId } = await ownerOrg(request);
      const target = await targetMember(orgId, request.params.userId);
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
      const { userId: actor, orgId } = await ownerOrg(request);
      const target = await targetMember(orgId, request.params.userId);
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
      const { userId: actor, orgId } = await ownerOrg(request);
      const target = await targetMember(orgId, request.params.userId);
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

  app.patch<{ Params: OrgParams & { deviceId: string } }>(
    "/v1/orgs/:orgId/devices/:deviceId",
    wrap<OrgParams & { deviceId: string }>(async (request, reply) => {
      const { userId: actor, orgId } = await ownerOrg(request);
      const body = devicePatch.parse(request.body);
      const id = parsePid(request.params.deviceId, "dev");
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
      const { userId: actor, orgId } = await ownerOrg(request);
      const id = parsePid(request.params.deviceId, "dev");
      const r = await sql<{ user_id: string }>`DELETE FROM core.org_devices WHERE id = ${id} AND org_id = ${orgId} RETURNING user_id`.execute(ctx.db);
      if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Device not found");
      invalidateDeviceCache(r.rows[0].user_id);
      await writeAuditEvent(ctx.db, { orgId, actorUserId: actor, action: "device.deleted", targetType: "device", targetId: id, metadata: { userId: r.rows[0].user_id }, ip: request.ip });
      void reply.code(204).send();
    }),
  );

  /* ---------------------------- API tokens ---------------------------- */

  app.get<{ Params: OrgParams }>(
    "/v1/orgs/:orgId/api-tokens",
    wrap<OrgParams>(async (request, reply) => {
      const { orgId } = await ownerOrg(request);
      const r = await sql<{ id: string; name: string; token_prefix: string; scopes: string[]; base_ids: string[] | null; expires_at: Date | null; last_used_at: Date | null; revoked_at: Date | null; created_at: Date }>`
        SELECT id, name, token_prefix, scopes, base_ids, expires_at, last_used_at, revoked_at, created_at
        FROM core.api_tokens WHERE org_id = ${orgId} ORDER BY created_at DESC LIMIT 200
      `.execute(ctx.db);
      const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
      void reply.send({
        tokens: r.rows.map((t) => ({
          id: pid("tok", t.id),
          name: t.name,
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
      const { userId, orgId } = await ownerOrg(request);
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
      const { userId, orgId } = await ownerOrg(request);
      const id = parsePid(request.params.tokenId, "tok");
      const r = await sql<{ id: string }>`
        UPDATE core.api_tokens SET revoked_at = coalesce(revoked_at, now()) WHERE id = ${id} AND org_id = ${orgId} RETURNING id
      `.execute(ctx.db);
      if (!r.rows[0]) throw new ApiError(404, "NOT_FOUND", "Token not found");
      await writeAuditEvent(ctx.db, { orgId, actorUserId: userId, action: "api_token.revoked", targetType: "api_token", targetId: id, ip: request.ip });
      void reply.code(204).send();
    }),
  );
}
