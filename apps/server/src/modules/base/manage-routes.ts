import { sql } from "kysely";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { ApiError, handleRouteError, notFound } from "../../http/errors.js";
import { getWorkspaceAccess, isOrgManager, isOrgManagerRole } from "../access/workspace-access.js";
import { invalidateBaseSnapshotCache } from "../access/compile.js";
import { writeAuditEvent } from "../audit/write.js";
import { resolveBaseContext } from "../access/helpers.js";
import { assertCan } from "../access/assert.js";
import { compileForUser, compileForWorkspace } from "../access/compile.js";
import { duplicateBase } from "./duplicate-base.js";
import { NO_ACCESS_ROLE, combineBaseRole } from "@tableos/permissions";

const duplicateBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    withRecords: z.boolean().optional(),
    workspaceId: z.string().optional(),
  })
  .default({});

const ROLE_RANK: Record<string, number> = {
  owner: 50,
  creator: 40,
  editor: 30,
  commenter: 20,
  viewer: 10,
  interface_only: 5,
};

function higherRole(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return (ROLE_RANK[a] ?? 0) >= (ROLE_RANK[b] ?? 0) ? a : b;
}

/**
 * Users who can access a base: anyone with a base- or workspace-level grant,
 * plus organization owners/admins. Role is the strongest applicable role.
 */
export async function listBaseCollaborators(
  db: AppContext["db"],
  baseId: string,
  workspaceId: string,
  orgId: string,
): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
  const rows = await sql<{
    user_id: string;
    email: string;
    display_name: string;
    grant_role: string | null;
    grant_scope: string | null;
    org_role: string;
  }>`
    SELECT u.id AS user_id, u.email, u.display_name,
           g.role AS grant_role, g.resource_type AS grant_scope,
           m.role AS org_role
    FROM core.organization_members m
    JOIN core.users u ON u.id = m.user_id AND u.status = 'active'
    LEFT JOIN core.access_grants g
      ON g.principal_type = 'user'
     AND g.principal_id = m.user_id
     AND (g.expires_at IS NULL OR g.expires_at > now())
     AND (
       (g.resource_type = 'base' AND g.resource_id = ${baseId})
       OR (g.resource_type = 'workspace' AND g.resource_id = ${workspaceId})
     )
    WHERE m.org_id = ${orgId} AND m.status = 'active'
  `.execute(db);

  const byUser = new Map<
    string,
    { id: string; name: string; email: string; base: string | null; workspace: string | null; orgOwner: boolean }
  >();
  for (const row of rows.rows) {
    const existing = byUser.get(row.user_id) ?? {
      id: row.user_id,
      name: row.display_name || row.email,
      email: row.email,
      base: null as string | null,
      workspace: null as string | null,
      orgOwner: false,
    };
    if (row.grant_role && row.grant_scope === "base") {
      existing.base = row.grant_role === NO_ACCESS_ROLE ? (existing.base ?? NO_ACCESS_ROLE) : higherRole(existing.base === NO_ACCESS_ROLE ? null : existing.base, row.grant_role);
    }
    if (row.grant_role && row.grant_scope === "workspace") existing.workspace = higherRole(existing.workspace, row.grant_role);
    if (row.org_role === "owner") existing.orgOwner = true;
    byUser.set(row.user_id, existing);
  }

  return [...byUser.values()]
    .map((u) => ({
      ...u,
      role: u.orgOwner || u.workspace === "owner" ? "owner" : combineBaseRole(u.base, u.workspace),
    }))
    .filter((u): u is typeof u & { role: string } => u.role !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((u) => ({ id: pid("usr", u.id), name: u.name, email: u.email, role: u.role }));
}

export async function registerBaseManageRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): Promise<void> {
  app.get<{ Params: { baseId: string } }>(
    "/v1/bases/:baseId/collaborators",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const baseId = parsePid(request.params.baseId, "bas");
        const base = await resolveBaseContext(ctx.db, user.id, baseId);
        if (!base.ok) {
          notFound(request, reply, "Base not found");
          return;
        }
        const snapshot = await compileForUser(ctx.db, user.id, baseId);
        assertCan(snapshot, "base.read");

        const collaborators = await listBaseCollaborators(
          ctx.db,
          baseId,
          base.workspaceId,
          base.orgId,
        );
        // Emails: only Owners, Admins and Workspace Owners (questionnaire G19).
        const ws = await getWorkspaceAccess(ctx.db, user.id, base.workspaceId);
        const seeEmails = Boolean(ws && (isOrgManagerRole(ws.orgRole) || ws.workspaceRole === "owner"));
        const me = pid("usr", user.id);
        void reply.send({
          collaborators: seeEmails ? collaborators : collaborators.map((c) => (c.id === me ? c : { ...c, email: "" })),
        });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  app.post<{ Params: { baseId: string } }>(
    "/v1/bases/:baseId/duplicate",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const baseId = parsePid(request.params.baseId, "bas");
        const body = duplicateBody.parse(request.body ?? {});
        const base = await resolveBaseContext(ctx.db, user.id, baseId);
        if (!base.ok) {
          notFound(request, reply, "Base not found");
          return;
        }
        const snapshot = await compileForUser(ctx.db, user.id, baseId);
        assertCan(snapshot, "base.read");
        // A copy holds all the data, so only the organization's Owners and Admins may make one,
        // and only into a workspace of the same organization.
        if (!(await isOrgManager(ctx.db, user.id, base.orgId))) {
          throw new ApiError(403, "FORBIDDEN", "Only Owners and Admins can duplicate a base");
        }

        const targetWorkspaceId = body.workspaceId
          ? parsePid(body.workspaceId, "wsp")
          : base.workspaceId;
        const target = await sql<{ org_id: string }>`
          SELECT org_id FROM core.workspaces WHERE id = ${targetWorkspaceId} AND deleted_at IS NULL
        `.execute(ctx.db);
        if (target.rows[0]?.org_id !== base.orgId) {
          throw new ApiError(403, "FORBIDDEN", "A base can only be duplicated into a workspace of the same organization");
        }
        const wsSnapshot = await compileForWorkspace(
          ctx.db,
          user.id,
          targetWorkspaceId,
        );
        assertCan(wsSnapshot, "base.manage_schema");

        const name = body.name ?? `${base.name} copy`;
        const result = await duplicateBase(ctx.db, {
          sourceBaseId: baseId,
          targetWorkspaceId,
          orgId: base.orgId,
          shardId: ctx.defaultShardId,
          userId: user.id,
          name,
          withRecords: body.withRecords ?? true,
        });
        void reply.code(201).send({ id: pid("bas", result.baseId), name });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  /**
   * Move a base to another workspace of the same organization (questionnaire G18). Owners and
   * Admins, or someone who is Workspace Owner of both workspaces; they must be Creator of the
   * base and may create bases in the target. Roles given on the old workspace no longer apply.
   */
  app.post<{ Params: { baseId: string } }>(
    "/v1/bases/:baseId/move",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const baseId = parsePid(request.params.baseId, "bas");
        const body = moveBody.parse(request.body);
        const base = await resolveBaseContext(ctx.db, user.id, baseId);
        if (!base.ok) {
          notFound(request, reply, "Base not found");
          return;
        }
        assertCan(await compileForUser(ctx.db, user.id, baseId), "base.manage_schema");
        const target = parsePid(body.workspaceId, "wsp");
        if (target === base.workspaceId) {
          void reply.send({ ok: true, workspaceId: pid("wsp", target) });
          return;
        }
        const t = await sql<{ org_id: string }>`
          SELECT org_id FROM core.workspaces WHERE id = ${target} AND deleted_at IS NULL AND status = 'active'
        `.execute(ctx.db);
        if (t.rows[0]?.org_id !== base.orgId) {
          throw new ApiError(403, "FORBIDDEN", "A base can only move to a workspace of the same organization");
        }
        assertCan(await compileForWorkspace(ctx.db, user.id, target), "base.manage_schema");
        const [from, to] = await Promise.all([
          getWorkspaceAccess(ctx.db, user.id, base.workspaceId),
          getWorkspaceAccess(ctx.db, user.id, target),
        ]);
        const manager = await isOrgManager(ctx.db, user.id, base.orgId);
        if (!manager && !(from?.workspaceRole === "owner" && to?.workspaceRole === "owner")) {
          throw new ApiError(403, "FORBIDDEN", "Only Owners, Admins and Workspace Owners of both workspaces can move a base");
        }

        await ctx.db.transaction().execute(async (trx) => {
          for (const table of MOVE_TABLES) {
            await sql`UPDATE ${sql.table(table)} SET workspace_id = ${target} WHERE base_id = ${baseId}`.execute(trx);
          }
          await sql`UPDATE data.bases SET workspace_id = ${target}, updated_at = now() WHERE id = ${baseId}`.execute(trx);
          await sql`
            UPDATE core.public_link_directory SET workspace_id = ${target}
            WHERE share_link_id IN (SELECT id FROM data.share_links WHERE base_id = ${baseId})
          `.execute(trx);
          await sql`UPDATE core.base_directory SET updated_at = now() WHERE base_id = ${baseId}`.execute(trx);
          await sql`UPDATE data.base_runtime SET perm_epoch = perm_epoch + 1, updated_at = now() WHERE base_id = ${baseId}`.execute(trx);
        });
        invalidateBaseSnapshotCache(baseId);
        await writeAuditEvent(ctx.db, {
          orgId: base.orgId,
          workspaceId: target,
          actorUserId: user.id,
          action: "base.moved",
          targetType: "base",
          targetId: baseId,
          metadata: { from: base.workspaceId, to: target, name: base.name },
          ip: request.ip,
        });
        void reply.send({ ok: true, workspaceId: pid("wsp", target) });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );
}

const moveBody = z.object({ workspaceId: z.string() });

/** Every table that keeps both a base_id and its workspace_id (checked against the schema in tests). */
const MOVE_TABLES = [
  "core.access_grants",
  "core.base_directory",
  "core.invitations",
  "core.notifications",
  "data.attachments",
  "data.automation_runs",
  "data.automations",
  "data.base_changes",
  "data.base_runtime",
  "data.comments",
  "data.computed_stale",
  "data.deletion_batches",
  "data.export_jobs",
  "data.field_dependencies",
  "data.fields",
  "data.import_jobs",
  "data.interface_pages",
  "data.interface_versions",
  "data.interfaces",
  "data.link_relations",
  "data.long_operations",
  "data.outbox_events",
  "data.record_index_num",
  "data.record_index_text",
  "data.record_index_time",
  "data.record_links",
  "data.record_revisions",
  "data.record_subscriptions",
  "data.records",
  "data.search_documents",
  "data.share_links",
  "data.share_submissions",
  "data.table_syncs",
  "data.tables",
  "data.view_sections",
  "data.views",
] as const;
