import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import type { AppContext } from "../../lib/app-context.js";
import { parsePid, pid } from "../../lib/public-ids.js";
import { ApiError, handleRouteError } from "../../http/errors.js";
import { withBaseTx } from "../../kernel/mutation.js";
import { assertCan } from "../access/assert.js";
import { compileForUser } from "../access/compile.js";
import { resolveBaseContext } from "../access/helpers.js";
import { writeAuditEvent } from "../audit/write.js";
import { bootstrapDefaultTable } from "../base/bootstrap-default-table.js";
import { mfaKey } from "../auth/mfa-pending.js";
import { loadConnection } from "../integrations/connections.js";
import { HUBSPOT_OBJECTS, type HubSpotObject } from "../integrations/hubspot.js";
import {
  editableSyncedFieldIds,
  loadSync,
  mapSourceField,
  requestSyncStop,
  runTableSync,
  sourceFieldsInOrder,
  startTableSync,
  type SyncRow,
} from "./engine.js";

const createBody = z.object({
  sourceTableId: z.string(),
  name: z.string().trim().min(1).max(255).optional(),
  intervalMinutes: z.number().int().min(1).max(1440).optional(),
});
const patchBody = z.object({
  status: z.enum(["active", "paused"]).optional(),
  intervalMinutes: z.number().int().min(1).max(1440).optional(),
  /** Write edits back to the source (HubSpot syncs only). */
  twoWay: z.boolean().optional(),
});

type BaseParams = { baseId: string };
type TableParams = { baseId: string; tableId: string };

export function syncDto(s: SyncRow, names: { baseName: string; tableName: string } | null) {
  return {
    id: s.id,
    provider: s.provider,
    connectionId: s.connection_id,
    sourceBaseId: s.source_base_id ? pid("bas", s.source_base_id) : null,
    sourceTableId: s.source_table_id ? pid("tbl", s.source_table_id) : null,
    sourceBaseName: names?.baseName ?? null,
    sourceTableName: names?.tableName ?? null,
    status: s.status,
    intervalMinutes: s.interval_minutes,
    lastSyncedAt: s.last_synced_at ? new Date(s.last_synced_at).toISOString() : null,
    lastError: s.last_error,
    recordCount: s.last_record_count,
    syncedFieldIds: Object.values(s.field_map ?? {}).map((f) => pid("fld", f)),
    twoWay: s.two_way,
    /** Synced fields that can be edited here and are written back to the source. */
    editableFieldIds: [...editableSyncedFieldIds(s)].map((f) => pid("fld", f)),
    /** A run is going right now (Sync now returns before it finishes). */
    running: Boolean(s.running),
    stopRequested: Boolean(s.running && s.cancel_requested),
    progress: s.running && s.progress ? s.progress : null,
    /** Values that didn't fit their field and were left empty (see GET …/sync/issues). */
    issueCount: Number(s.issue_count ?? 0),
    textFieldKeys: Object.keys(s.field_overrides ?? {}).filter((k) => s.field_overrides?.[k] === "text"),
  };
}

export async function sourceNames(db: AppContext["db"], s: Pick<SyncRow, "provider" | "source_table_id" | "connection_id" | "source_config">) {
  if (s.provider === "hubspot") {
    const object = String(s.source_config?.["object"] ?? "");
    const conn = s.connection_id ? await loadConnection(db, s.connection_id) : null;
    return {
      baseName: conn?.account_label ? `HubSpot (${conn.account_label})` : "HubSpot",
      tableName: HUBSPOT_OBJECTS[object as HubSpotObject]?.label ?? object,
    };
  }
  if (s.provider === "airtable") {
    const cfg = s.source_config ?? {};
    const baseName = typeof cfg["baseName"] === "string" ? cfg["baseName"] : null;
    return {
      baseName: baseName ? `Airtable (${baseName})` : "Airtable",
      tableName: typeof cfg["tableName"] === "string" ? cfg["tableName"] : "a table",
    };
  }
  if (s.provider === "gmail") {
    const conn = s.connection_id ? await loadConnection(db, s.connection_id) : null;
    const query = typeof s.source_config?.["query"] === "string" ? s.source_config["query"].trim() : "";
    return {
      baseName: conn?.account_label ? `Gmail (${conn.account_label})` : "Gmail",
      tableName: query ? `“${query}”` : "All mail",
    };
  }
  if (!s.source_table_id) return null;
  const r = await sql<{ base_name: string; table_name: string }>`
    SELECT b.name AS base_name, t.name AS table_name
    FROM data.tables t INNER JOIN core.base_directory b ON b.base_id = t.base_id
    WHERE t.id = ${s.source_table_id}
  `.execute(db);
  const row = r.rows[0];
  return row ? { baseName: row.base_name, tableName: row.table_name } : null;
}

export async function registerSyncRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const deps = { db: ctx.db, redis: ctx.redis, storage: ctx.storage, secretKey: mfaKey(ctx.env), google: ctx.env };

  function wrap<P>(fn: (request: FastifyRequest<{ Params: P }>, reply: FastifyReply) => Promise<void>) {
    return async (request: FastifyRequest<{ Params: P }>, reply: FastifyReply) => {
      try {
        await fn(request, reply);
      } catch (err) {
        handleRouteError(request, reply, err);
      }
    };
  }

  async function base(request: FastifyRequest<{ Params: BaseParams }>, action: "base.read" | "base.manage_schema" | "record.update") {
    const user = request.user;
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in first");
    const baseId = parsePid(request.params.baseId, "bas");
    const b = await resolveBaseContext(ctx.db, user.id, baseId);
    if (!b.ok) throw new ApiError(404, "NOT_FOUND", "Base not found");
    assertCan(await compileForUser(ctx.db, user.id, baseId), action);
    return { user, baseId, orgId: b.orgId, workspaceId: b.workspaceId };
  }

  async function tableSync(request: FastifyRequest<{ Params: TableParams }>, action: "base.read" | "base.manage_schema" | "record.update") {
    const s = await base(request, action);
    const tableId = parsePid(request.params.tableId, "tbl");
    const sync = await loadSync(ctx.db, { tableId });
    if (!sync || sync.base_id !== s.baseId) throw new ApiError(404, "NOT_FOUND", "This table isn't synced");
    return { ...s, tableId, sync };
  }

  /** Tables in the organization's other bases that this person can read. */
  app.get<{ Params: BaseParams }>(
    "/v1/bases/:baseId/sync-sources",
    wrap<BaseParams>(async (request, reply) => {
      const s = await base(request, "base.read");
      const bases = await sql<{ base_id: string; name: string; workspace_name: string }>`
        SELECT b.base_id, b.name, w.name AS workspace_name
        FROM core.base_directory b INNER JOIN core.workspaces w ON w.id = b.workspace_id
        WHERE b.org_id = ${s.orgId} AND b.base_id <> ${s.baseId} AND b.status = 'active' AND b.deleted_at IS NULL AND w.deleted_at IS NULL
        ORDER BY w.name, b.order_key
      `.execute(ctx.db);
      const readable: typeof bases.rows = [];
      for (const b of bases.rows) {
        const snap = await compileForUser(ctx.db, s.user.id, b.base_id);
        if (snap.effectiveBaseRole) readable.push(b);
      }
      const ids = readable.map((b) => b.base_id);
      const tables = ids.length
        ? (
            await sql<{ id: string; base_id: string; name: string; record_count: number }>`
              SELECT id, base_id, name, record_count FROM data.tables
              WHERE base_id = ANY(${ids}::uuid[]) AND deleted_at IS NULL ORDER BY order_key
            `.execute(ctx.db)
          ).rows
        : [];
      void reply.send({
        bases: readable.map((b) => ({
          id: pid("bas", b.base_id),
          name: b.name,
          workspaceName: b.workspace_name,
          tables: tables
            .filter((t) => t.base_id === b.base_id)
            .map((t) => ({ id: pid("tbl", t.id), name: t.name, recordCount: Number(t.record_count) })),
        })),
      });
    }),
  );

  /** Create a synced copy of a table from another base, then fill it. */
  app.post<{ Params: BaseParams }>(
    "/v1/bases/:baseId/synced-tables",
    wrap<BaseParams>(async (request, reply) => {
      const s = await base(request, "base.manage_schema");
      const body = createBody.parse(request.body ?? {});
      const sourceTableId = parsePid(body.sourceTableId, "tbl");
      const src = await sql<{ base_id: string; name: string; org_id: string }>`
        SELECT t.base_id, t.name, b.org_id FROM data.tables t INNER JOIN core.base_directory b ON b.base_id = t.base_id
        WHERE t.id = ${sourceTableId} AND t.deleted_at IS NULL AND b.deleted_at IS NULL
      `.execute(ctx.db);
      const source = src.rows[0];
      if (!source) throw new ApiError(404, "NOT_FOUND", "Source table not found");
      if (source.org_id !== s.orgId) throw new ApiError(422, "VALIDATION_FAILED", "You can only sync tables from bases in the same organization");
      if (source.base_id === s.baseId) throw new ApiError(422, "VALIDATION_FAILED", "That table is already in this base — link to it directly");
      const srcSnap = await compileForUser(ctx.db, s.user.id, source.base_id);
      if (!srcSnap.effectiveBaseRole) throw new ApiError(404, "NOT_FOUND", "Source table not found");

      const existing = await sql<{ table_id: string }>`
        SELECT s.table_id FROM data.table_syncs s INNER JOIN data.tables t ON t.id = s.table_id AND t.deleted_at IS NULL
        WHERE s.base_id = ${s.baseId} AND s.source_table_id = ${sourceTableId}
      `.execute(ctx.db);
      if (existing.rows[0]) {
        void reply.send({ tableId: pid("tbl", existing.rows[0].table_id), existing: true });
        return;
      }

      const baseName = (await sql<{ name: string }>`SELECT name FROM core.base_directory WHERE base_id = ${source.base_id}`.execute(ctx.db)).rows[0]?.name ?? "";
      const taken = await sql<{ name: string }>`SELECT name FROM data.tables WHERE base_id = ${s.baseId} AND deleted_at IS NULL`.execute(ctx.db);
      const takenSet = new Set(taken.rows.map((r) => r.name.toLowerCase()));
      let name = body.name ?? source.name;
      if (takenSet.has(name.toLowerCase())) name = `${source.name} (${baseName})`;
      for (let i = 2; takenSet.has(name.toLowerCase()); i++) name = `${source.name} (${baseName}) ${i}`;

      const srcFields = await sourceFieldsInOrder(ctx.db, sourceTableId);
      const srcPrimary = srcFields[0];
      const primaryMapped = srcPrimary ? mapSourceField(srcPrimary) : null;
      const primaryType = primaryMapped && !["checkbox", "attachment", "long_text"].includes(primaryMapped.type) ? primaryMapped : { type: "text", config: {}, conv: "text" as const };

      let tableId = "";
      await withBaseTx(
        ctx.db,
        { orgId: s.orgId, workspaceId: s.workspaceId, baseId: s.baseId, actor: { actorType: "user", actorId: s.user.id, via: "api" }, redis: ctx.redis },
        async (_m, trx) => {
          const boot = await bootstrapDefaultTable(trx, {
            workspaceId: s.workspaceId,
            baseId: s.baseId,
            userId: s.user.id,
            tableName: name,
            emptyRecords: 0,
            fields: [
              { name: srcPrimary?.name ?? "Name", type: primaryType.type, config: primaryType.config },
              // Tables whose primary is their Record ID would otherwise get two fields with that name.
              { name: (srcPrimary?.name ?? "").trim().toLowerCase() === "record id" ? "Local record ID" : "Record ID", type: "record_id", config: {} },
            ],
          });
          tableId = boot.tableId;
          const fieldMap = srcPrimary ? { [srcPrimary.id]: boot.fieldId } : {};
          await sql`
            INSERT INTO data.table_syncs (workspace_id, base_id, table_id, source_base_id, source_table_id, owner_user_id, field_map, interval_minutes)
            VALUES (${s.workspaceId}, ${s.baseId}, ${tableId}, ${source.base_id}, ${sourceTableId}, ${s.user.id},
                    ${JSON.stringify(fieldMap)}::jsonb, ${body.intervalMinutes ?? 5})
          `.execute(trx);
          return {
            kind: "schema" as const,
            ops: [{ op: "table.created", tableId, name }],
            tableIds: [tableId],
            eventType: "table.created",
            aggregateType: "table",
            aggregateId: tableId,
            payload: { tableId, name, syncedFrom: sourceTableId },
          };
        },
      );
      const sync = await loadSync(ctx.db, { tableId });
      let result = null;
      let error: string | null = null;
      try {
        result = await runTableSync(deps, sync!.id);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      await writeAuditEvent(ctx.db, {
        orgId: s.orgId,
        workspaceId: s.workspaceId,
        actorUserId: s.user.id,
        action: "table.sync_created",
        targetType: "table",
        targetId: tableId,
        metadata: { sourceTableId, sourceBaseId: source.base_id },
        ip: request.ip,
      });
      void reply.code(201).send({ tableId: pid("tbl", tableId), result, error });
    }),
  );

  app.get<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync",
    wrap<TableParams>(async (request, reply) => {
      const { sync } = await tableSync(request, "base.read");
      void reply.send({ sync: syncDto(sync, await sourceNames(ctx.db, sync)) });
    }),
  );

  /**
   * Sync now. Starts the run and answers right away (the bar shows progress and offers Stop);
   * `{ "wait": true }` waits for the result instead (API clients, tests).
   */
  app.post<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync/run",
    wrap<TableParams>(async (request, reply) => {
      const { sync } = await tableSync(request, "record.update");
      const wait = (request.body as { wait?: unknown } | null)?.wait === true;
      let result = null;
      let started = false;
      if (wait) {
        try {
          result = await runTableSync(deps, sync.id, { full: true });
          started = true;
        } catch {
          // Stored on the sync row; returned below.
        }
      } else {
        started = await startTableSync(deps, sync.id, { full: true }, (err) =>
          request.log.warn({ err: err instanceof Error ? err.message : err, syncId: sync.id }, "Sync now failed"),
        );
        // Let the run take the lock so the answer already says "running".
        await new Promise((r) => setTimeout(r, 150));
      }
      const fresh = (await loadSync(ctx.db, { id: sync.id }))!;
      void reply.code(wait ? 200 : 202).send({ result, started, alreadyRunning: !wait && !started, sync: syncDto(fresh, await sourceNames(ctx.db, fresh)) });
    }),
  );

  /** Stop the run in progress at its next checkpoint (records written so far stay). */
  app.post<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync/stop",
    wrap<TableParams>(async (request, reply) => {
      const { sync } = await tableSync(request, "record.update");
      const stopping = await requestSyncStop(ctx.db, sync.id);
      const fresh = (await loadSync(ctx.db, { id: sync.id }))!;
      void reply.send({ stopping, sync: syncDto(fresh, await sourceNames(ctx.db, fresh)) });
    }),
  );

  /** Values the sync couldn't write (they were left empty), grouped by field on the client. */
  app.get<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync/issues",
    wrap<TableParams>(async (request, reply) => {
      const { sync } = await tableSync(request, "base.read");
      const r = await sql<{ source_record_id: string; dest_record_id: string | null; source_field_id: string; field_name: string; record_label: string; value: string | null; message: string; created_at: Date }>`
        SELECT source_record_id, dest_record_id, source_field_id, field_name, record_label, value, message, created_at
        FROM data.table_sync_issues WHERE sync_id = ${sync.id}
        ORDER BY field_name, record_label LIMIT 2000
      `.execute(ctx.db);
      void reply.send({
        issues: r.rows.map((x) => ({
          recordId: x.dest_record_id ? pid("rec", x.dest_record_id) : null,
          sourceRecordId: x.source_record_id,
          fieldKey: x.source_field_id,
          fieldId: sync.field_map?.[x.source_field_id] ? pid("fld", sync.field_map[x.source_field_id]!) : null,
          fieldName: x.field_name,
          recordLabel: x.record_label,
          value: x.value,
          message: x.message,
          at: x.created_at.toISOString(),
        })),
      });
    }),
  );

  /**
   * What to do with a field's invalid values: "text" keeps that field as plain text so every
   * value fits (and re-syncs the affected records); "dismiss" leaves them empty and clears the list.
   */
  app.post<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync/issues/resolve",
    wrap<TableParams>(async (request, reply) => {
      const s = await tableSync(request, "base.manage_schema");
      const body = z.object({ fieldKey: z.string().min(1).max(300), action: z.enum(["text", "dismiss"]) }).parse(request.body ?? {});
      if (body.action === "text") {
        await ctx.db.transaction().execute(async (trx) => {
          await sql`
            UPDATE data.table_syncs SET field_overrides = field_overrides || ${JSON.stringify({ [body.fieldKey]: "text" })}::jsonb, updated_at = now()
            WHERE id = ${s.sync.id}
          `.execute(trx);
          // Rewrite the records that had a problem in this field on the next run.
          await sql`
            UPDATE data.table_sync_records m SET content_hash = ''
            FROM data.table_sync_issues i
            WHERE m.sync_id = ${s.sync.id} AND i.sync_id = m.sync_id AND i.source_record_id = m.source_record_id
              AND i.source_field_id = ${body.fieldKey}
          `.execute(trx);
          await sql`
            DELETE FROM data.table_sync_issues
            WHERE sync_id = ${s.sync.id} AND source_field_id = ${body.fieldKey}
              AND NOT EXISTS (SELECT 1 FROM data.table_sync_records m WHERE m.sync_id = ${s.sync.id} AND m.source_record_id = table_sync_issues.source_record_id)
          `.execute(trx);
        });
        await startTableSync(deps, s.sync.id, { full: true }, (err) =>
          request.log.warn({ err: err instanceof Error ? err.message : err }, "Re-sync after keeping a field as text failed"),
        );
      } else {
        await sql`DELETE FROM data.table_sync_issues WHERE sync_id = ${s.sync.id} AND source_field_id = ${body.fieldKey}`.execute(ctx.db);
      }
      await writeAuditEvent(ctx.db, {
        orgId: s.orgId,
        workspaceId: s.workspaceId,
        actorUserId: s.user.id,
        action: body.action === "text" ? "table.sync_field_as_text" : "table.sync_issues_dismissed",
        targetType: "table",
        targetId: s.tableId,
        metadata: { fieldKey: body.fieldKey },
        ip: request.ip,
      });
      await new Promise((r) => setTimeout(r, 150));
      const fresh = (await loadSync(ctx.db, { id: s.sync.id }))!;
      void reply.send({ sync: syncDto(fresh, await sourceNames(ctx.db, fresh)) });
    }),
  );

  app.patch<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync",
    wrap<TableParams>(async (request, reply) => {
      const { sync, user } = await tableSync(request, "base.manage_schema");
      const body = patchBody.parse(request.body ?? {});
      if (body.twoWay === true && sync.provider !== "hubspot") {
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          sync.provider === "tableos"
            ? "Tables synced from another base are one-way; edit the source base instead"
            : "Only HubSpot tables can sync both ways; edit the records at the source instead",
        );
      }
      if (body.twoWay === true && !sync.two_way && sync.owner_user_id !== user.id) {
        // Edits are written with the HubSpot account of whoever set up the sync.
        throw new ApiError(403, "FORBIDDEN", "Only the person who set up this sync can turn on two-way sync");
      }
      await sql`
        UPDATE data.table_syncs
        SET status = coalesce(${body.status ?? null}, status),
            interval_minutes = coalesce(${body.intervalMinutes ?? null}, interval_minutes),
            two_way = coalesce(${body.twoWay ?? null}::boolean, two_way),
            updated_at = now()
        WHERE id = ${sync.id}
      `.execute(ctx.db);
      // Pause also stops a run in progress; Resume starts one right away.
      if (body.status === "paused") await requestSyncStop(ctx.db, sync.id);
      if (body.status === "active" && sync.status !== "active") {
        await startTableSync(deps, sync.id, { full: true }, (err) =>
          request.log.warn({ err: err instanceof Error ? err.message : err }, "Sync after Resume failed"),
        );
        await new Promise((r) => setTimeout(r, 150));
      }
      const fresh = (await loadSync(ctx.db, { id: sync.id }))!;
      void reply.send({ sync: syncDto(fresh, await sourceNames(ctx.db, fresh)) });
    }),
  );

  /** Stop syncing: the table keeps its data and becomes a normal, editable table. */
  app.delete<{ Params: TableParams }>(
    "/v1/bases/:baseId/tables/:tableId/sync",
    wrap<TableParams>(async (request, reply) => {
      const s = await tableSync(request, "base.manage_schema");
      await sql`DELETE FROM data.table_syncs WHERE id = ${s.sync.id}`.execute(ctx.db);
      await writeAuditEvent(ctx.db, { orgId: s.orgId, workspaceId: s.workspaceId, actorUserId: s.user.id, action: "table.sync_removed", targetType: "table", targetId: s.tableId, ip: request.ip });
      void reply.code(204).send();
    }),
  );
}
