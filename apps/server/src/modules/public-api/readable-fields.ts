import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { selectOptionsOf } from "@tabula/filter";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { normalizeApiPath } from "../access/api-tokens.js";

/**
 * API-token responses from the record endpoints use field names as keys and option names for
 * select values, like the requests may. `returnFieldsByFieldId=true` (query string or JSON body)
 * keeps the app's wire format: field IDs and option IDs, which survive renames.
 */
const RECORD_ROUTE = /^\/v1\/bases\/[^/]+\/tables\/([^/]+)\/records(?:\/(query|group|batch|[^/]+))?$/;

interface FieldInfo {
  name: string;
  type: string;
  options: Map<string, string>;
}

type Json = Record<string, unknown>;

function wantsFieldIds(request: FastifyRequest): boolean {
  const q = (request.query ?? {}) as Json;
  const b = request.body && typeof request.body === "object" ? (request.body as Json) : {};
  return [q["returnFieldsByFieldId"], b["returnFieldsByFieldId"]].some((v) => v === true || v === "true" || v === "1");
}

async function loadFields(ctx: AppContext, tableIdPublic: string): Promise<Map<string, FieldInfo>> {
  const tableId = parsePid(tableIdPublic, "tbl");
  const r = await sql<{ id: string; name: string; type: string; config: Record<string, unknown> | null }>`
    SELECT id, name, type, config FROM data.fields WHERE table_id = ${tableId} AND deleted_at IS NULL
  `.execute(ctx.db);
  const out = new Map<string, FieldInfo>();
  for (const f of r.rows) {
    const options = new Map<string, string>();
    if (f.type === "single_select" || f.type === "multi_select") {
      for (const o of selectOptionsOf(f.config)) options.set(o.id, o.label);
    }
    out.set(pid("fld", f.id), { name: f.name, type: f.type, options });
  }
  return out;
}

function readableValue(f: FieldInfo, v: unknown): unknown {
  if (!f.options.size) return v;
  if (typeof v === "string") return f.options.get(v) ?? v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? (f.options.get(x) ?? x) : x));
  return v;
}

function readableRecord(rec: unknown, fields: Map<string, FieldInfo>): unknown {
  if (!rec || typeof rec !== "object" || !("fields" in rec)) return rec;
  const src = (rec as { fields: Json }).fields ?? {};
  const out: Json = {};
  for (const [key, v] of Object.entries(src)) {
    const f = fields.get(key);
    if (f) out[f.name] = readableValue(f, v);
    else out[key] = v;
  }
  return { ...(rec as Json), fields: out };
}

function readableGroups(body: Json, request: FastifyRequest, fields: Map<string, FieldInfo>): Json {
  const groupBy = ((request.body as Json | undefined)?.["groupBy"] as Array<{ fieldId?: string }> | undefined) ?? [];
  const byRef = (ref: string | undefined) =>
    ref ? (fields.get(ref) ?? [...fields.values()].find((f) => f.name.toLowerCase() === ref.toLowerCase())) : undefined;
  const groupFields = groupBy.map((g) => byRef(g.fieldId));
  const groups = (body["groups"] as Json[] | undefined)?.map((g) => {
    const values = Array.isArray(g["values"]) ? (g["values"] as unknown[]).map((v, i) => (groupFields[i] ? readableValue(groupFields[i]!, v) : v)) : g["values"];
    const aggregates: Json = {};
    for (const [k, v] of Object.entries((g["aggregates"] as Json | undefined) ?? {})) {
      const [op, ref] = k.split(":", 2) as [string, string | undefined];
      const f = ref ? fields.get(ref) : undefined;
      aggregates[f ? `${op}:${f.name}` : k] = v;
    }
    return { ...g, value: groupFields[0] ? readableValue(groupFields[0], g["value"]) : g["value"], values, aggregates };
  });
  return groups ? { ...body, groups } : body;
}

declare module "fastify" {
  interface FastifyRequest {
    readableFields?: { fields: Map<string, FieldInfo>; group: boolean };
  }
}

export function registerReadableFieldNames(app: FastifyInstance, ctx: AppContext): void {
  // Loaded before the handler: handlers send without returning the reply, so onSend must not wait.
  app.addHook("preHandler", async (request) => {
    if (!request.apiTokenId || request.method === "DELETE") return;
    const m = RECORD_ROUTE.exec(normalizeApiPath(request.url));
    if (!m || m[2] === "batch-delete" || wantsFieldIds(request)) return;
    try {
      request.readableFields = { fields: await loadFields(ctx, m[1]!), group: m[2] === "group" };
    } catch {
      // Unknown table id: the route answers 404 itself.
    }
  });

  app.addHook("onSend", (request, reply, payload, done) => {
    const r = request.readableFields;
    if (!r || reply.statusCode >= 300 || typeof payload !== "string" || !payload) {
      done(null, payload);
      return;
    }
    let body: Json;
    try {
      body = JSON.parse(payload) as Json;
    } catch {
      done(null, payload);
      return;
    }
    if (r.group) body = readableGroups(body, request, r.fields);
    if (Array.isArray(body["records"])) body = { ...body, records: (body["records"] as unknown[]).map((x) => readableRecord(x, r.fields)) };
    if (body["record"]) body = { ...body, record: readableRecord(body["record"], r.fields) };
    done(null, JSON.stringify(body));
  });
}
