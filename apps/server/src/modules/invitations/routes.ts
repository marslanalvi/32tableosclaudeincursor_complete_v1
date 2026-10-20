import { generateUuidV7 } from "@tabula/types";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  mapWorkspaceRoleToBase,
  type BaseRole,
  type WorkspaceRole,
} from "@tabula/permissions";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import {
  forbidden,
  handleRouteError,
  notFound,
  sendApiError,
  unauthorized,
  validationProblem,
} from "../../http/errors.js";
import { writeAuditEvent } from "../audit/write.js";
import { compileForUser, invalidateUserSnapshotCache } from "../access/compile.js";
import {
  BASE_ROLE_RANK,
  WORKSPACE_ROLE_RANK,
  getOrgRole,
  getWorkspaceAccess,
  isOrgManagerRole,
} from "../access/workspace-access.js";
import { grantCeiling, roleRank } from "../access/delegation.js";
import { sendEmail } from "../automations/mailer.js";
import { invalidateDeviceCache } from "../access/devices.js";

/** "owner" is the workspace Owner role (questionnaire B5: Owners and Admins may give it). */
const WORKSPACE_ROLES = ["owner", "creator", "editor", "commenter", "viewer"] as const;
const BASE_ROLES = ["creator", "editor", "commenter", "viewer"] as const;
const ORG_ROLE_ORDER = ["member", "admin", "owner"] as const;

const createInviteBody = z
  .object({
    email: z.string().email().max(320),
    workspaceId: z.string().optional(),
    baseId: z.string().optional(),
    /** Several bases in one invitation (same organization). */
    baseIds: z.array(z.string()).min(1).max(100).optional(),
    /** Workspace or base role; not needed for an Admin/Owner invitation without data access. */
    role: z.enum(WORKSPACE_ROLES).optional(),
    /** Account type after accepting. Admin and Owner: only Owners may invite them. */
    orgRole: z.enum(ORG_ROLE_ORDER).optional(),
    /** For an Admin/Owner invitation that gives no workspace or base yet. */
    organizationId: z.string().optional(),
  })
  .refine(
    (b) => {
      const targets = [b.workspaceId, b.baseId, b.baseIds].filter(Boolean).length;
      if (targets === 0) return Boolean(b.organizationId) && (b.orgRole === "admin" || b.orgRole === "owner");
      return targets === 1 && Boolean(b.role);
    },
    { message: "Provide a role and exactly one of workspaceId, baseId or baseIds (or an organization for an Admin/Owner invitation)" },
  );

const acceptBody = z.object({
  token: z.string().min(16).max(512),
});

function hashInviteToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

interface InviteRow {
  id: string;
  org_id: string;
  workspace_id: string | null;
  base_id: string | null;
  email: string;
  email_normalized: string;
  role: string;
  status: string;
  expires_at: Date;
  invited_by: string | null;
  created_at: Date;
  extra_base_ids?: string[] | null;
  org_role?: string;
}

function inviteDto(row: InviteRow) {
  return {
    id: pid("inv", row.id),
    email: row.email,
    workspaceId: row.workspace_id ? pid("wsp", row.workspace_id) : null,
    baseId: row.base_id ? pid("bas", row.base_id) : null,
    role: row.role,
    orgRole: row.org_role ?? "member",
    status: row.status === "pending" && row.expires_at < new Date() ? "expired" : row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function registerInvitationRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): Promise<void> {
  /**
   * Invite someone to a workspace (role ∈ workspace roles) or a base
   * (role ∈ creator/editor/commenter/viewer). The inviter must be able to
   * manage members there and cannot grant a role above their own.
   */
  app.post("/v1/invitations", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        unauthorized(request, reply);
        return;
      }
      const body = createInviteBody.parse(request.body);
      const orgRole = body.orgRole ?? "member";

      let orgId!: string;
      let workspaceId: string | null = null;
      let baseId: string | null = null;
      let extraBaseIds: string[] = [];
      let targetName!: string;
      // Owners and Admins invite; Admins only where they are Creator, never above their own role.
      const mayInvite = async (org: string): Promise<boolean> => {
        const inviterRole = await getOrgRole(ctx.db, user.id, org);
        if (!isOrgManagerRole(inviterRole)) {
          forbidden(request, reply, "Only Owners and Admins can invite people");
          return false;
        }
        if (orgRole !== "member" && inviterRole !== "owner") {
          forbidden(request, reply, "Only Owners can invite Admins and Owners");
          return false;
        }
        return true;
      };
      const tooHigh = () =>
        forbidden(request, reply, "Admins can only invite to workspaces and bases where they are Creator, and not above their own role");

      const basePids = body.baseIds ?? (body.baseId ? [body.baseId] : null);
      if (basePids) {
        if (!(BASE_ROLES as readonly string[]).includes(body.role!)) {
          validationProblem(request, reply, `Role "${body.role}" is not a base role`);
          return;
        }
        const ids = [...new Set(basePids.map((b) => parsePid(b, "bas")))];
        const names: string[] = [];
        for (const id of ids) {
          const dir = await sql<{ workspace_id: string; org_id: string; name: string }>`
            SELECT workspace_id, org_id, name FROM core.base_directory
            WHERE base_id = ${id} AND status = 'active' AND deleted_at IS NULL LIMIT 1
          `.execute(ctx.db);
          const d = dir.rows[0];
          const snap = d ? await compileForUser(ctx.db, user.id, id) : null;
          if (!d || !snap?.effectiveBaseRole || (orgId && d.org_id !== orgId)) {
            notFound(request, reply, "Base not found");
            return;
          }
          if (!orgId) {
            if (!(await mayInvite(d.org_id))) return;
            orgId = d.org_id;
            workspaceId = d.workspace_id;
          }
          const ceiling = await grantCeiling(ctx.db, user.id, await getOrgRole(ctx.db, user.id, orgId), { baseId: id });
          if (ceiling < roleRank("base", body.role)) {
            tooHigh();
            return;
          }
          names.push(d.name);
        }
        baseId = ids[0]!;
        extraBaseIds = ids.slice(1);
        targetName = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more bases` : names.join(", ");
      } else if (body.workspaceId) {
        const wsId = parsePid(body.workspaceId, "wsp");
        workspaceId = wsId;
        const access = await getWorkspaceAccess(ctx.db, user.id, wsId);
        if (!access || !access.workspaceRole) {
          notFound(request, reply, "Workspace not found");
          return;
        }
        if (!(await mayInvite(access.orgId))) return;
        orgId = access.orgId;
        if ((await grantCeiling(ctx.db, user.id, access.orgRole, { workspaceId: wsId })) < roleRank("workspace", body.role)) {
          tooHigh();
          return;
        }
        const ws = await sql<{ name: string }>`
          SELECT name FROM core.workspaces WHERE id = ${wsId}
        `.execute(ctx.db);
        targetName = ws.rows[0]?.name ?? "a workspace";
      } else {
        orgId = parsePid(body.organizationId!, "org");
        if (!(await mayInvite(orgId))) return;
        const o = await sql<{ name: string }>`SELECT name FROM core.organizations WHERE id = ${orgId}`.execute(ctx.db);
        targetName = o.rows[0]?.name ?? "the organization";
      }

      const role = body.role ?? orgRole;
      const emailNormalized = body.email.toLowerCase();
      const pending = await sql<{ id: string }>`
        SELECT id FROM core.invitations
        WHERE email_normalized = ${emailNormalized} AND status = 'pending' AND expires_at > now()
          AND org_id = ${orgId}
          AND workspace_id IS NOT DISTINCT FROM ${workspaceId}::uuid
          AND base_id IS NOT DISTINCT FROM ${baseId}::uuid
        LIMIT 1
      `.execute(ctx.db);
      if (pending.rows[0]) {
        // Re-inviting replaces the previous pending invitation.
        await sql`
          UPDATE core.invitations SET status = 'revoked', revoked_at = now(), updated_at = now()
          WHERE id = ${pending.rows[0].id}
        `.execute(ctx.db);
      }

      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashInviteToken(token);
      const inviteId = generateUuidV7();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

      await sql`
        INSERT INTO core.invitations (
          id, org_id, workspace_id, base_id, email, email_normalized, role,
          resource_type, resource_id, token_hash, invited_by, expires_at, extra_base_ids, org_role
        ) VALUES (
          ${inviteId}, ${orgId}, ${workspaceId}, ${baseId}, ${body.email}, ${emailNormalized},
          ${role}, ${baseId ? "base" : workspaceId ? "workspace" : "org"}, ${baseId ?? workspaceId ?? orgId},
          ${tokenHash}, ${user.id}, ${expiresAt}, ${extraBaseIds}::uuid[], ${orgRole}
        )
      `.execute(ctx.db);

      const acceptUrl = `${ctx.env.APP_URL}/invite/${token}`;
      const asText = orgRole === "member" ? role : body.role ? `${orgRole === "owner" ? "an Owner" : "an Admin"} (${role})` : orgRole === "owner" ? "an Owner" : "an Admin";
      try {
        await sendEmail(ctx.db, {
          to: [body.email],
          subject: `${user.displayName} invited you to ${targetName} on TableOS`,
          text: `${user.displayName} (${user.email}) invited you to join "${targetName}" as ${asText}.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires on ${expiresAt.toUTCString()}.`,
          orgId,
          workspaceId,
          source: "invitation",
          sourceId: inviteId,
        });
      } catch (err) {
        request.log.warn({ err }, "invitation email not stored");
      }

      await writeAuditEvent(ctx.db, {
        orgId,
        workspaceId,
        actorUserId: user.id,
        action: "invite.created",
        targetType: "invitation",
        targetId: inviteId,
        metadata: { email: emailNormalized, role, orgRole, baseId, extraBaseIds },
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      });

      void reply.code(201).send({
        invitation: {
          id: pid("inv", inviteId),
          email: body.email,
          workspaceId: workspaceId ? pid("wsp", workspaceId) : null,
          baseId: baseId ? pid("bas", baseId) : null,
          baseIds: baseId ? [baseId, ...extraBaseIds].map((id) => pid("bas", id)) : [],
          role,
          orgRole,
          status: "pending",
          expiresAt: expiresAt.toISOString(),
          acceptToken: token,
          acceptUrl,
        },
      });
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  });

  /** Pending/past invitations of a workspace (or base) — members managers only. */
  app.get<{ Querystring: { workspaceId?: string; baseId?: string } }>(
    "/v1/invitations",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          unauthorized(request, reply);
          return;
        }
        let rows: InviteRow[];
        if (request.query.baseId) {
          const baseId = parsePid(request.query.baseId, "bas");
          const snap = await compileForUser(ctx.db, user.id, baseId);
          if (!snap.effectiveBaseRole) {
            notFound(request, reply, "Base not found");
            return;
          }
          const dir = await sql<{ org_id: string }>`
            SELECT org_id FROM core.base_directory WHERE base_id = ${baseId} LIMIT 1
          `.execute(ctx.db);
          if (!dir.rows[0] || !isOrgManagerRole(await getOrgRole(ctx.db, user.id, dir.rows[0].org_id))) {
            forbidden(request, reply, "Only Owners and Admins can view invitations");
            return;
          }
          rows = (
            await sql<InviteRow>`
              SELECT id, org_id, workspace_id, base_id, email, email_normalized, role, status,
                     expires_at, invited_by, created_at, org_role
              FROM core.invitations WHERE base_id = ${baseId}
              ORDER BY created_at DESC LIMIT 200
            `.execute(ctx.db)
          ).rows;
        } else if (request.query.workspaceId) {
          const workspaceId = parsePid(request.query.workspaceId, "wsp");
          const access = await getWorkspaceAccess(ctx.db, user.id, workspaceId);
          if (!access?.workspaceRole) {
            notFound(request, reply, "Workspace not found");
            return;
          }
          if (!isOrgManagerRole(access.orgRole)) {
            forbidden(request, reply, "Only Owners and Admins can view invitations");
            return;
          }
          rows = (
            await sql<InviteRow>`
              SELECT id, org_id, workspace_id, base_id, email, email_normalized, role, status,
                     expires_at, invited_by, created_at, org_role
              FROM core.invitations WHERE workspace_id = ${workspaceId}
              ORDER BY created_at DESC LIMIT 200
            `.execute(ctx.db)
          ).rows;
        } else {
          validationProblem(request, reply, "workspaceId or baseId is required");
          return;
        }
        void reply.send({ invitations: rows.map(inviteDto) });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  /** Revoke a pending invitation. */
  app.delete<{ Params: { invitationId: string } }>(
    "/v1/invitations/:invitationId",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          unauthorized(request, reply);
          return;
        }
        const id = parsePid(request.params.invitationId, "inv");
        const res = await sql<InviteRow>`
          SELECT id, org_id, workspace_id, base_id, email, email_normalized, role, status,
                 expires_at, invited_by, created_at, org_role
          FROM core.invitations WHERE id = ${id} LIMIT 1
        `.execute(ctx.db);
        const row = res.rows[0];
        if (!row) {
          notFound(request, reply, "Invitation not found");
          return;
        }
        const revokerRole = await getOrgRole(ctx.db, user.id, row.org_id);
        if (!isOrgManagerRole(revokerRole)) {
          notFound(request, reply, "Invitation not found");
          return;
        }
        if (revokerRole !== "owner" && row.org_role !== "member") {
          forbidden(request, reply, "Only Owners can cancel invitations for Admins and Owners");
          return;
        }
        await sql`
          UPDATE core.invitations SET status = 'revoked', revoked_at = now(), updated_at = now()
          WHERE id = ${id} AND status = 'pending'
        `.execute(ctx.db);
        await writeAuditEvent(ctx.db, {
          orgId: row.org_id,
          workspaceId: row.workspace_id,
          actorUserId: user.id,
          action: "invite.revoked",
          targetType: "invitation",
          targetId: id,
          ip: request.ip,
        });
        void reply.code(204).send();
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  /** Public preview of an invitation (for the accept page, before sign-in). */
  app.get<{ Params: { token: string } }>(
    "/v1/public/invitations/:token",
    async (request, reply) => {
      try {
        const token = request.params.token;
        if (token.length < 16 || token.length > 512) {
          notFound(request, reply, "Invitation not found");
          return;
        }
        const res = await sql<InviteRow & { workspace_name: string | null; base_name: string | null; inviter_name: string | null; org_name: string | null }>`
          SELECT i.id, i.org_id, i.workspace_id, i.base_id, i.email, i.email_normalized, i.role,
                 i.status, i.expires_at, i.invited_by, i.created_at, i.org_role,
                 w.name AS workspace_name, bd.name AS base_name, u.display_name AS inviter_name,
                 o.name AS org_name
          FROM core.invitations i
          LEFT JOIN core.organizations o ON o.id = i.org_id
          LEFT JOIN core.workspaces w ON w.id = i.workspace_id
          LEFT JOIN core.base_directory bd ON bd.base_id = i.base_id
          LEFT JOIN core.users u ON u.id = i.invited_by
          WHERE i.token_hash = ${hashInviteToken(token)}
          LIMIT 1
        `.execute(ctx.db);
        const row = res.rows[0];
        if (!row) {
          notFound(request, reply, "Invitation not found");
          return;
        }
        const dto = inviteDto(row);
        void reply.send({
          invitation: {
            ...dto,
            workspaceName: row.workspace_name,
            baseName: row.base_name,
            organizationName: row.org_name,
            inviterName: row.inviter_name,
          },
        });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  app.post("/v1/invitations/accept", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        unauthorized(request, reply);
        return;
      }
      const body = acceptBody.parse(request.body);
      const tokenHash = hashInviteToken(body.token);

      const invite = await sql<InviteRow>`
        SELECT id, org_id, workspace_id, base_id, email, email_normalized, role, status,
               expires_at, invited_by, created_at, extra_base_ids, org_role
        FROM core.invitations
        WHERE token_hash = ${tokenHash}
        LIMIT 1
      `.execute(ctx.db);

      const row = invite.rows[0];
      if (!row) {
        notFound(request, reply, "Invitation not found");
        return;
      }
      if (row.status === "accepted") {
        sendApiError(request, reply, 409, "CONFLICT", "This invitation has already been accepted");
        return;
      }
      if (row.status !== "pending" || row.expires_at < new Date()) {
        sendApiError(request, reply, 410, "INVITATION_EXPIRED", "This invitation has expired or was revoked");
        return;
      }
      if (row.email_normalized !== user.email.toLowerCase()) {
        forbidden(
          request,
          reply,
          `This invitation was sent to ${row.email}. Sign in with that email to accept it.`,
        );
        return;
      }

      await ctx.db.transaction().execute(async (trx) => {
        await sql`
          INSERT INTO core.organization_members (org_id, user_id, role, source)
          VALUES (${row.org_id}, ${user.id}, ${row.org_role ?? "member"}, 'invite')
          ON CONFLICT (org_id, user_id) DO UPDATE SET
            status = 'active',
            updated_at = now(),
            -- An invitation can raise the account type, never lower it.
            role = CASE
              WHEN array_position(${[...ORG_ROLE_ORDER]}::text[], EXCLUDED.role)
                 > array_position(${[...ORG_ROLE_ORDER]}::text[], core.organization_members.role)
              THEN EXCLUDED.role ELSE core.organization_members.role END
        `.execute(trx);

        if (row.base_id) {
          const baseRole = row.role as BaseRole;
          for (const bid of [row.base_id, ...(row.extra_base_ids ?? [])]) {
            const dir = await sql<{ workspace_id: string }>`
              SELECT workspace_id FROM core.base_directory
              WHERE base_id = ${bid} AND org_id = ${row.org_id} AND deleted_at IS NULL LIMIT 1
            `.execute(trx);
            const wsId = dir.rows[0]?.workspace_id;
            if (!wsId) continue;
            const existing = await sql<{ id: string; role: string }>`
              SELECT id, role FROM core.access_grants
              WHERE resource_type = 'base' AND resource_id = ${bid}
                AND principal_type = 'user' AND principal_id = ${user.id}
              LIMIT 1
            `.execute(trx);
            const cur = existing.rows[0];
            if (!cur) {
              await sql`
                INSERT INTO core.access_grants (
                  id, org_id, resource_type, resource_id, workspace_id, base_id,
                  principal_type, principal_id, role, source, granted_by
                ) VALUES (
                  ${generateUuidV7()}, ${row.org_id}, 'base', ${bid}, ${wsId}, ${bid},
                  'user', ${user.id}, ${baseRole}, 'invite', ${row.invited_by}
                )
              `.execute(trx);
            } else if (BASE_ROLE_RANK[baseRole] > (BASE_ROLE_RANK[cur.role as BaseRole] ?? 0)) {
              await sql`
                UPDATE core.access_grants SET role = ${baseRole}, updated_at = now() WHERE id = ${cur.id}
              `.execute(trx);
            }
            await sql`
              UPDATE data.base_runtime SET perm_epoch = perm_epoch + 1, updated_at = now()
              WHERE base_id = ${bid}
            `.execute(trx);
          }
        } else if (row.workspace_id) {
          const wsRole = row.role as WorkspaceRole;
          const existing = await sql<{ id: string; role: string }>`
            SELECT id, role FROM core.access_grants
            WHERE resource_type = 'workspace' AND resource_id = ${row.workspace_id}
              AND principal_type = 'user' AND principal_id = ${user.id}
            LIMIT 1
          `.execute(trx);
          const cur = existing.rows[0];
          if (!cur) {
            await sql`
              INSERT INTO core.access_grants (
                id, org_id, resource_type, resource_id, workspace_id,
                principal_type, principal_id, role, source, granted_by
              ) VALUES (
                ${generateUuidV7()}, ${row.org_id}, 'workspace', ${row.workspace_id}, ${row.workspace_id},
                'user', ${user.id}, ${wsRole}, 'invite', ${row.invited_by}
              )
            `.execute(trx);
          } else if (WORKSPACE_ROLE_RANK[wsRole] > (WORKSPACE_ROLE_RANK[cur.role as WorkspaceRole] ?? 0)) {
            await sql`
              UPDATE core.access_grants SET role = ${wsRole}, updated_at = now() WHERE id = ${cur.id}
            `.execute(trx);
          }
          await sql`
            UPDATE data.base_runtime SET perm_epoch = perm_epoch + 1, updated_at = now()
            WHERE base_id IN (
              SELECT base_id FROM core.base_directory WHERE workspace_id = ${row.workspace_id}
            )
          `.execute(trx);
        }

        await sql`
          UPDATE core.invitations
          SET status = 'accepted', accepted_at = now(), accepted_by = ${user.id}, updated_at = now()
          WHERE id = ${row.id}
        `.execute(trx);
      });
      invalidateUserSnapshotCache(user.id);
      invalidateDeviceCache(user.id);

      await writeAuditEvent(ctx.db, {
        orgId: row.org_id,
        workspaceId: row.workspace_id,
        actorUserId: user.id,
        action: "invite.accepted",
        targetType: "invitation",
        targetId: row.id,
        metadata: { role: row.role, baseId: row.base_id },
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      });

      void reply.send({
        ok: true,
        workspaceId: row.workspace_id ? pid("wsp", row.workspace_id) : null,
        baseId: row.base_id ? pid("bas", row.base_id) : null,
        role: row.role,
        effectiveBaseRole: row.base_id ? row.role : mapWorkspaceRoleToBase(row.role as WorkspaceRole),
      });
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  });
}
