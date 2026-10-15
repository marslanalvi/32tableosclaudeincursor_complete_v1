import { request, type TableSyncInfo } from "../api.ts";

/** Cross-base data: synced tables (read-only mirrors of tables in other bases). */

export interface SyncSourceBase {
  id: string;
  name: string;
  workspaceName: string;
  tables: { id: string; name: string; recordCount: number }[];
}

/** A value the sync couldn't write; it was left empty and the rest of the sync went through. */
export interface SyncIssue {
  recordId: string | null;
  sourceRecordId: string;
  /** Source field key ("__record" when the whole record couldn't be written). */
  fieldKey: string;
  fieldId: string | null;
  fieldName: string;
  recordLabel: string;
  value: string | null;
  message: string;
  at: string;
}

const b = (id: string) => `/v1/bases/${encodeURIComponent(id)}`;

export const syncApi = {
  sources(baseId: string) {
    return request<{ bases: SyncSourceBase[] }>(`${b(baseId)}/sync-sources`);
  },
  create(baseId: string, body: { sourceTableId: string; name?: string; intervalMinutes?: number }) {
    return request<{ tableId: string; existing?: boolean; error?: string | null }>(`${b(baseId)}/synced-tables`, { method: "POST", json: body });
  },
  /** Starts a run and returns at once (`sync.running`); poll the base until it finishes. */
  runNow(baseId: string, tableId: string) {
    return request<{ sync: TableSyncInfo; started: boolean; alreadyRunning: boolean }>(
      `${b(baseId)}/tables/${encodeURIComponent(tableId)}/sync/run`,
      { method: "POST", json: {} },
    );
  },
  /** Stop the run in progress (records written so far stay). */
  stopRun(baseId: string, tableId: string) {
    return request<{ stopping: boolean; sync: TableSyncInfo }>(`${b(baseId)}/tables/${encodeURIComponent(tableId)}/sync/stop`, { method: "POST", json: {} });
  },
  issues(baseId: string, tableId: string) {
    return request<{ issues: SyncIssue[] }>(`${b(baseId)}/tables/${encodeURIComponent(tableId)}/sync/issues`);
  },
  resolveIssues(baseId: string, tableId: string, body: { fieldKey: string; action: "text" | "dismiss" }) {
    return request<{ sync: TableSyncInfo }>(`${b(baseId)}/tables/${encodeURIComponent(tableId)}/sync/issues/resolve`, { method: "POST", json: body });
  },
  update(baseId: string, tableId: string, body: { status?: "active" | "paused"; intervalMinutes?: number; twoWay?: boolean }) {
    return request<{ sync: TableSyncInfo }>(`${b(baseId)}/tables/${encodeURIComponent(tableId)}/sync`, { method: "PATCH", json: body });
  },
  stop(baseId: string, tableId: string) {
    return request<void>(`${b(baseId)}/tables/${encodeURIComponent(tableId)}/sync`, { method: "DELETE" });
  },
};
