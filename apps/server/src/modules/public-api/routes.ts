import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { ApiError, handleRouteError } from "../../http/errors.js";
import { compileForUser } from "../access/compile.js";
import { normalizeApiPath } from "../access/api-tokens.js";

const HOP_BY_HOP = new Set(["host", "content-length", "connection", "transfer-encoding", "keep-alive"]);

function callerHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(request.headers)) {
    if (v === undefined || HOP_BY_HOP.has(k)) continue;
    headers[k] = Array.isArray(v) ? v.join(", ") : v;
  }
  return headers;
}

/**
 * Developer-facing API conveniences:
 *  - `GET /v1/api/bases` lists every base (with its tables and their ids) the caller can read.
 *  - `/v1/tables/:tableId/...` accepts a table id alone; the base is looked up and the
 *    request is served by the regular `/v1/bases/:baseId/tables/:tableId/...` route, so
 *    permissions, token scopes and validation are identical.
 */
export async function registerPublicApiRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get("/v1/api/bases", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in or send an API token");
      const candidates = await sql<{ base_id: string; workspace_id: string; name: string; workspace_name: string }>`
        SELECT DISTINCT b.base_id, b.workspace_id, b.name, w.name AS workspace_name, b.order_key
        FROM core.base_directory b
        INNER JOIN core.workspaces w ON w.id = b.workspace_id
        INNER JOIN core.organization_members m ON m.org_id = b.org_id AND m.user_id = ${user.id} AND m.status = 'active'
        WHERE b.status = 'active' AND b.deleted_at IS NULL AND w.deleted_at IS NULL
        ORDER BY w.name, b.order_key
      `.execute(ctx.db);
      const readable: typeof candidates.rows = [];
      for (const b of candidates.rows) {
        const snap = await compileForUser(ctx.db, user.id, b.base_id);
        if (snap.effectiveBaseRole) readable.push(b);
      }
      const ids = readable.map((b) => b.base_id);
      const tables = ids.length
        ? (
            await sql<{ id: string; base_id: string; name: string }>`
              SELECT id, base_id, name FROM data.tables
              WHERE base_id = ANY(${ids}::uuid[]) AND deleted_at IS NULL ORDER BY order_key
            `.execute(ctx.db)
          ).rows
        : [];
      void reply.send({
        bases: readable.map((b) => ({
          id: pid("bas", b.base_id),
          name: b.name,
          workspace: { id: pid("wsp", b.workspace_id), name: b.workspace_name },
          tables: tables.filter((t) => t.base_id === b.base_id).map((t) => ({ id: pid("tbl", t.id), name: t.name })),
        })),
      });
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  });

  async function forward(request: FastifyRequest<{ Params: { tableId: string; "*"?: string } }>, reply: FastifyReply) {
    try {
      const tableId = parsePid(request.params.tableId, "tbl");
      const r = await sql<{ base_id: string }>`
        SELECT base_id FROM data.tables WHERE id = ${tableId} AND deleted_at IS NULL
      `.execute(ctx.db);
      const baseId = r.rows[0]?.base_id;
      if (!baseId) throw new ApiError(404, "NOT_FOUND", "Table not found");

      const query = request.url.split("?", 2)[1];
      const rest = normalizeApiPath(request.url).slice(`/v1/tables/${request.params.tableId}`.length);
      const url = `/v1/bases/${pid("bas", baseId)}/tables/${request.params.tableId}${rest}${query ? `?${query}` : ""}`;
      await relay(request, reply, request.method, url, request.body);
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  }

  /** Serve the request with another route of this app, keeping the caller's credentials. */
  async function relay(request: FastifyRequest, reply: FastifyReply, method: string, url: string, body: unknown) {
    const res = await app.inject({
      method: method as "GET",
      url,
      headers: callerHeaders(request),
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    for (const [k, v] of Object.entries(res.headers)) {
      if (v === undefined || HOP_BY_HOP.has(k)) continue;
      void reply.header(k, v);
    }
    void reply.code(res.statusCode).send(res.rawPayload);
  }

  // One table's schema: the table entry of the base schema, so permissions and shape are identical.
  app.get<{ Params: { baseId: string; tableId: string } }>("/v1/bases/:baseId/tables/:tableId", async (request, reply) => {
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/bases/${encodeURIComponent(request.params.baseId)}`,
        headers: callerHeaders(request),
      });
      if (res.statusCode !== 200) {
        void reply
          .code(res.statusCode)
          .header("content-type", res.headers["content-type"] ?? "application/json")
          .send(res.rawPayload);
        return;
      }
      const base = res.json<{ id: string; tables: Array<{ id: string }> }>();
      const table = base.tables.find((t) => t.id === request.params.tableId);
      if (!table) throw new ApiError(404, "NOT_FOUND", "Table not found");
      void reply.send({ ...table, baseId: base.id });
    } catch (err) {
      handleRouteError(request, reply, err);
    }
  });

  const methods = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
  app.route({ method: [...methods], url: "/v1/tables/:tableId", handler: forward });
  app.route({ method: [...methods], url: "/v1/tables/:tableId/*", handler: forward });
}
