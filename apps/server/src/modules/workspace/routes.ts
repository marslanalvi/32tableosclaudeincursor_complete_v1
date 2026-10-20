import { generateUuidV7 } from "@tabula/types";
import { sql } from "kysely";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { ApiError, handleRouteError, notFound } from "../../http/errors.js";
import { userCanAccessWorkspace } from "../access/helpers.js";
import { compileForUser } from "../access/compile.js";
import { getWorkspaceAccess, isOrgManagerRole } from "../access/workspace-access.js";
import { requestMayAccess } from "../../kernel/request-context.js";

const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  /** Needed when the person is Owner/Admin of several organizations. */
  organizationId: z.string().optional(),
});
const renameBody = z.object({ name: z.string().trim().min(1).max(200) });

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): Promise<void> {
  /**
   * Rename and delete: workspace owners, plus the organization's Admins on any workspace
   * (questionnaire B3), even ones they can't open.
   */
  async function assertWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
    const access = await getWorkspaceAccess(ctx.db, userId, workspaceId);
    if (!access || (!access.workspaceRole && access.orgRole !== "admin")) throw new ApiError(404, "NOT_FOUND", "Workspace not found");
    if (access.workspaceRole !== "owner" && access.orgRole !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Only workspace owners and Admins can rename or delete a workspace");
    }
  }

  app.get("/v1/workspaces", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        notFound(request, reply);
        return;
      }

      const result = await sql<{ id: string; name: string; org_id: string; org_name: string; org_role: string; ws_role: string | null }>`
        SELECT w.id, w.name, w.org_id, o.name AS org_name, m.role AS org_role,
          (SELECT g.role FROM core.access_grants g
           WHERE g.principal_type = 'user' AND g.principal_id = ${user.id}
             AND g.resource_type = 'workspace' AND g.resource_id = w.id AND g.role <> 'none'
             AND (g.expires_at IS NULL OR g.expires_at > now())
           LIMIT 1) AS ws_role
        FROM core.workspaces w
        INNER JOIN core.organizations o ON o.id = w.org_id AND o.status = 'active'
        INNER JOIN core.organization_members m
          ON m.org_id = w.org_id AND m.user_id = ${user.id} AND m.status = 'active'
        WHERE w.deleted_at IS NULL AND w.status = 'active'
          AND (
            m.role IN ('owner', 'admin')
            OR EXISTS (
              SELECT 1 FROM core.access_grants g
              WHERE g.principal_type = 'user' AND g.principal_id = ${user.id}
                AND g.workspace_id = w.id
                AND g.resource_type IN ('workspace', 'base')
                AND g.role <> 'none'
                AND (g.expires_at IS NULL OR g.expires_at > now())
            )
          )
        ORDER BY w.created_at ASC
      `.execute(ctx.db);

      void reply.send({
        workspaces: result.rows.filter((r) => requestMayAccess(r.org_id)).map((r) => ({
          id: pid("wsp", r.id),
          name: r.name,
          organizationId: pid("org", r.org_id),
          organizationName: r.org_name,
          orgRole: r.org_role,
          /** May create bases here: Owners, and Admins who are Creator or Owner of this workspace. */
          canManage: r.org_role === "owner" || (isOrgManagerRole(r.org_role) && (r.ws_role === "owner" || r.ws_role === "creator")),
          /** null = only reaches some bases here (no workspace role: no contacts). */
          workspaceRole: r.org_role === "owner" ? "owner" : r.ws_role,
        })),
      });
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  });

  app.post("/v1/workspaces", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        notFound(request, reply);
        return;
      }

      const body = createBody.parse(request.body);

      // Only Owners and Admins create workspaces, and only in an organization they run.
      const membership = await sql<{ org_id: string; name: string }>`
        SELECT m.org_id, o.name FROM core.organization_members m
        INNER JOIN core.organizations o ON o.id = m.org_id AND o.status = 'active'
        WHERE m.user_id = ${user.id} AND m.status = 'active' AND m.role IN ('owner', 'admin')
        ORDER BY m.joined_at ASC
      `.execute(ctx.db);
      const allowed = membership.rows.filter((r) => requestMayAccess(r.org_id));
      if (allowed.length === 0) {
        throw new ApiError(403, "FORBIDDEN", "Only Owners and Admins can create workspaces");
      }
      let org = allowed[0]!;
      if (body.organizationId) {
        const wanted = parsePid(body.organizationId, "org");
        const match = allowed.find((r) => r.org_id === wanted);
        if (!match) throw new ApiError(403, "FORBIDDEN", "You can't create workspaces in that organization");
        org = match;
      } else if (allowed.length > 1) {
        throw new ApiError(422, "VALIDATION_FAILED", "Choose the organization for the new workspace", {
          organizations: allowed.map((r) => ({ id: pid("org", r.org_id), name: r.name })),
        });
      }

      const workspaceId = generateUuidV7();

      await ctx.db.transaction().execute(async (trx) => {
        await sql`
          INSERT INTO core.workspaces (id, org_id, name, created_by)
          VALUES (${workspaceId}, ${org.org_id}, ${body.name}, ${user.id})
        `.execute(trx);

        await sql`
          INSERT INTO core.workspace_directory (workspace_id, org_id, shard_id, region)
          VALUES (${workspaceId}, ${org.org_id}, ${ctx.defaultShardId}, 'local')
        `.execute(trx);

        await sql`
          INSERT INTO core.access_grants (
            id, org_id, resource_type, resource_id, workspace_id,
            principal_type, principal_id, role, source, granted_by
          ) VALUES (
            ${generateUuidV7()}, ${org.org_id}, 'workspace', ${workspaceId}, ${workspaceId},
            'user', ${user.id}, 'owner', 'creator', ${user.id}
          )
        `.execute(trx);
      });

      void reply.code(201).send({
        workspace: { id: pid("wsp", workspaceId), name: body.name },
      });
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  });

  app.patch<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const workspaceId = parsePid(request.params.workspaceId, "wsp");
        const body = renameBody.parse(request.body);
        const access = await userCanAccessWorkspace(ctx.db, user.id, workspaceId);
        if (!access.ok) {
          notFound(request, reply, "Workspace not found");
          return;
        }
        await assertWorkspaceOwner(user.id, workspaceId);
        await sql`
          UPDATE core.workspaces SET name = ${body.name}, updated_at = now()
          WHERE id = ${workspaceId}
        `.execute(ctx.db);
        void reply.send({
          workspace: { id: pid("wsp", workspaceId), name: body.name },
        });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  app.delete<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const workspaceId = parsePid(request.params.workspaceId, "wsp");
        const access = await userCanAccessWorkspace(ctx.db, user.id, workspaceId);
        if (!access.ok) {
          notFound(request, reply, "Workspace not found");
          return;
        }
        await assertWorkspaceOwner(user.id, workspaceId);
        await ctx.db.transaction().execute(async (trx) => {
          await sql`
            UPDATE core.workspaces
            SET status = 'trashed', deleted_at = now(), updated_at = now()
            WHERE id = ${workspaceId}
          `.execute(trx);
          await sql`
            UPDATE core.base_directory
            SET status = 'trashed', deleted_at = now(), updated_at = now()
            WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
          `.execute(trx);
        });
        void reply.code(204).send();
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/members",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const workspaceId = parsePid(request.params.workspaceId, "wsp");
        const access = await getWorkspaceAccess(ctx.db, user.id, workspaceId);
        // Base-only guests are org members but not workspace members.
        if (!access?.workspaceRole) {
          notFound(request, reply, "Workspace not found");
          return;
        }
        const rows = await sql<{
          id: string;
          email: string;
          display_name: string;
          org_role: string;
          ws_role: string | null;
        }>`
          SELECT u.id, u.email, u.display_name, m.role AS org_role,
                 (SELECT g.role FROM core.access_grants g
                  WHERE g.principal_type = 'user' AND g.principal_id = u.id
                    AND g.resource_type = 'workspace' AND g.resource_id = ${workspaceId}
                  LIMIT 1) AS ws_role
          FROM core.organization_members m
          JOIN core.users u ON u.id = m.user_id AND u.status = 'active'
          WHERE m.org_id = ${access.orgId} AND m.status = 'active'
          ORDER BY u.display_name ASC, u.email ASC
        `.execute(ctx.db);
        let invitations: Array<{ id: string; email: string; role: string; expiresAt: string }> = [];
        try {
          const inv = await sql<{ id: string; email: string; role: string; expires_at: Date }>`
            SELECT id, email, role, expires_at FROM core.invitations
            WHERE workspace_id = ${workspaceId} AND accepted_at IS NULL AND status = 'pending'
              AND expires_at > now()
            ORDER BY expires_at DESC
            LIMIT 100
          `.execute(ctx.db);
          invitations = inv.rows.map((r) => ({
            id: pid("inv", r.id),
            email: r.email,
            role: r.role,
            expiresAt: new Date(r.expires_at).toISOString(),
          }));
        } catch {
          /* invitations schema may be mid-migration; members still listed */
        }
        // Emails: only Owners, Admins and Workspace Owners (questionnaire G19); others see names.
        const seeEmails = isOrgManagerRole(access.orgRole) || access.workspaceRole === "owner";
        void reply.send({
          members: rows.rows
            .filter((r) => r.ws_role || r.org_role === "owner")
            .map((r) => ({
            id: pid("usr", r.id),
            name: r.display_name || (seeEmails ? r.email : "Member"),
            email: seeEmails || r.id === user.id ? r.email : "",
            role: r.org_role === "owner" ? "owner" : r.ws_role,
          })),
          invitations: seeEmails ? invitations : [],
        });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/bases",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }

        const workspaceId = parsePid(request.params.workspaceId, "wsp");
        const access = await userCanAccessWorkspace(ctx.db, user.id, workspaceId);
        if (!access.ok) {
          notFound(request, reply, "Workspace not found");
          return;
        }

        const result = await sql<{ base_id: string; name: string; order_key: string }>`
          SELECT base_id, name, order_key
          FROM core.base_directory
          WHERE workspace_id = ${workspaceId}
            AND status = 'active'
            AND deleted_at IS NULL
          ORDER BY order_key ASC, created_at ASC
        `.execute(ctx.db);
        const visible: typeof result.rows = [];
        for (const r of result.rows) {
          if ((await compileForUser(ctx.db, user.id, r.base_id)).effectiveBaseRole) visible.push(r);
        }

        void reply.send({
          bases: visible.map((r) => ({
            id: pid("bas", r.base_id),
            name: r.name,
          })),
        });
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    },
  );
}
