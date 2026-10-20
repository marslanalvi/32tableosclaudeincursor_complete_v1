import { sql } from "kysely";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { notFound } from "../../http/errors.js";
import { handleWave4Error } from "../wave4/problems.js";
import { compileForUser } from "../access/compile.js";

function bodyText(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const key of ["text", "preview", "message", "body"]) {
      if (typeof b[key] === "string") return b[key] as string;
    }
  }
  return "";
}

/** Legacy rows (worker-created) have no link column: derive one from the body ids. */
function legacyLink(baseId: string | null, body: unknown): string | null {
  if (!baseId || !body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const rec = typeof b["recordId"] === "string" ? (b["recordId"] as string) : null;
  const tbl = typeof b["tableId"] === "string" ? (b["tableId"] as string) : null;
  if (!rec || !tbl) return `/bases/${pid("bas", baseId)}`;
  const recPid = rec.startsWith("rec_") ? rec : pid("rec", rec);
  const tblPid = tbl.startsWith("tbl_") ? tbl : pid("tbl", tbl);
  return `/bases/${pid("bas", baseId)}?table=${tblPid}&record=${recPid}`;
}

export async function registerNotificationsRoutes(
  app: FastifyInstance,
  ctx: AppContext,
): Promise<void> {
  app.get<{ Querystring: { unreadOnly?: string; limit?: string } }>(
    "/v1/notifications",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const limit = Math.min(Math.max(Number(request.query.limit ?? 50) || 50, 1), 200);
        const unreadOnly = request.query.unreadOnly === "true";
        const rows = await sql<{
          id: string;
          category: string;
          title: string;
          body: unknown;
          link: string | null;
          read_at: Date | null;
          created_at: Date;
          workspace_id: string | null;
          base_id: string | null;
          actor_user_id: string | null;
          actor_name: string | null;
          actor_email: string | null;
        }>`
          SELECT n.id, n.category, n.title, n.body, n.link, n.read_at, n.created_at,
                 n.workspace_id, n.base_id, n.actor_user_id,
                 u.display_name AS actor_name, u.email AS actor_email
          FROM core.notifications n
          LEFT JOIN core.users u ON u.id = n.actor_user_id
          WHERE n.user_id = ${user.id}
            ${unreadOnly ? sql`AND n.read_at IS NULL` : sql``}
          ORDER BY n.created_at DESC
          LIMIT ${limit * 3}
        `.execute(ctx.db);
        const unreadByBase = await sql<{ base_id: string | null; n: string }>`
          SELECT base_id, count(*)::text AS n FROM core.notifications
          WHERE user_id = ${user.id} AND read_at IS NULL
          GROUP BY base_id
        `.execute(ctx.db);
        // Notifications about a base the person can no longer open stay hidden (questionnaire G17).
        const baseIds = [...new Set([...rows.rows, ...unreadByBase.rows].map((r) => r.base_id).filter((b): b is string => Boolean(b)))];
        const open = new Set<string>();
        for (const b of baseIds) {
          if ((await compileForUser(ctx.db, user.id, b)).effectiveBaseRole) open.add(b);
        }
        const visible = rows.rows.filter((n) => !n.base_id || open.has(n.base_id)).slice(0, limit);
        const unreadCount = unreadByBase.rows
          .filter((r) => !r.base_id || open.has(r.base_id))
          .reduce((sum, r) => sum + Number(r.n), 0);

        void reply.send({
          notifications: visible.map((n) => ({
            id: pid("ntf", n.id),
            category: n.category,
            title: n.title,
            body: bodyText(n.body),
            link: n.link ?? legacyLink(n.base_id, n.body),
            readAt: n.read_at?.toISOString() ?? null,
            read: n.read_at !== null,
            createdAt: n.created_at.toISOString(),
            workspaceId: n.workspace_id ? pid("wsp", n.workspace_id) : null,
            baseId: n.base_id ? pid("bas", n.base_id) : null,
            actor: n.actor_user_id
              ? {
                  id: pid("usr", n.actor_user_id),
                  name: n.actor_name || n.actor_email || "",
                  email: n.actor_email ?? "",
                }
              : null,
          })),
          unreadCount,
        });
      } catch (err) {
        handleWave4Error(request, reply, err);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/notifications/:id/read",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const notificationId = parsePid(request.params.id, "ntf");
        await sql`
          UPDATE core.notifications SET read_at = now()
          WHERE id = ${notificationId} AND user_id = ${user.id} AND read_at IS NULL
        `.execute(ctx.db);
        void reply.send({ ok: true });
      } catch (err) {
        handleWave4Error(request, reply, err);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/notifications/:id/unread",
    async (request, reply) => {
      try {
        const user = request.user;
        if (!user) {
          notFound(request, reply);
          return;
        }
        const notificationId = parsePid(request.params.id, "ntf");
        await sql`
          UPDATE core.notifications SET read_at = NULL
          WHERE id = ${notificationId} AND user_id = ${user.id}
        `.execute(ctx.db);
        void reply.send({ ok: true });
      } catch (err) {
        handleWave4Error(request, reply, err);
      }
    },
  );

  app.post("/v1/notifications/read-all", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        notFound(request, reply);
        return;
      }
      const r = await sql`
        UPDATE core.notifications SET read_at = now()
        WHERE user_id = ${user.id} AND read_at IS NULL
      `.execute(ctx.db);
      void reply.send({ ok: true, updated: Number(r.numAffectedRows ?? 0) });
    } catch (err) {
      handleWave4Error(request, reply, err);
    }
  });
}
