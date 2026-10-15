import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { TableDto } from "../../lib/api.ts";
import { syncApi, type SyncIssue } from "../../lib/api-areas/sync.ts";
import { toast } from "../../app/toast.tsx";
import { Dialog } from "../../app/ui.tsx";
import styles from "./base-shell.module.css";

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

const n = (x: number) => x.toLocaleString();

/** Values the sync left empty because they didn't fit their field, grouped by field. */
function SyncIssuesDialog({ baseId, table, onClose }: { baseId: string; table: TableDto; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["sync-issues", baseId, table.id];
  const q = useQuery({ queryKey: key, queryFn: () => syncApi.issues(baseId, table.id) });
  const resolve = useMutation({
    mutationFn: (v: { fieldKey: string; action: "text" | "dismiss" }) => syncApi.resolveIssues(baseId, table.id, v),
    onSuccess: async (_res, v) => {
      toast.success(v.action === "text" ? "That field is now kept as text; the affected records are syncing again" : "Those values stay empty");
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["bases", baseId] });
    },
    onError: (err) => toast.error(err, "Could not apply that"),
  });
  const groups = useMemo(() => {
    const by = new Map<string, { fieldKey: string; fieldName: string; items: SyncIssue[] }>();
    for (const i of q.data?.issues ?? []) {
      const g = by.get(i.fieldKey) ?? { fieldKey: i.fieldKey, fieldName: i.fieldName, items: [] };
      g.items.push(i);
      by.set(i.fieldKey, g);
    }
    return [...by.values()].sort((a, b) => b.items.length - a.items.length);
  }, [q.data]);
  return (
    <Dialog title="Values that couldn't be synced" onClose={onClose} wide>
      <p className={styles.issuesIntro}>
        These values don’t fit their field (for example an invalid phone number). They were left empty; everything else synced. For each
        field, keep it as plain text so every value comes through, or leave those values empty.
      </p>
      {q.isLoading ? <p className={styles.issuesIntro}>Loading…</p> : null}
      {q.isSuccess && groups.length === 0 ? <p className={styles.issuesIntro}>Nothing to review: every value synced.</p> : null}
      <div className={styles.issuesList}>
        {groups.map((g) => (
          <section key={g.fieldKey} className={styles.issueGroup} data-testid="sync-issue-group">
            <header className={styles.issueHead}>
              <strong>{g.fieldName}</strong>
              <span>
                {n(g.items.length)} value{g.items.length === 1 ? "" : "s"}
              </span>
              <span style={{ flex: 1 }} />
              {g.fieldKey !== "__record" ? (
                <button
                  type="button"
                  className={styles.syncBtn}
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ fieldKey: g.fieldKey, action: "text" })}
                  title={`Change “${g.fieldName}” to a text field here so these values sync as they are`}
                >
                  Keep “{g.fieldName}” as text
                </button>
              ) : null}
              <button
                type="button"
                className={styles.syncBtn}
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ fieldKey: g.fieldKey, action: "dismiss" })}
              >
                Leave empty
              </button>
            </header>
            <table className={styles.issueTable}>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Value</th>
                  <th>Problem</th>
                </tr>
              </thead>
              <tbody>
                {g.items.slice(0, 200).map((i) => (
                  <tr key={`${i.sourceRecordId}:${i.fieldKey}`}>
                    <td>{i.recordLabel || "(no name)"}</td>
                    <td>
                      <code>{i.value ?? "—"}</code>
                    </td>
                    <td>{i.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {g.items.length > 200 ? <p className={styles.issuesIntro}>…and {n(g.items.length - 200)} more.</p> : null}
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/** Shown above a synced table: where the data comes from, how fresh it is, and run controls. */
export function SyncBar({ baseId, table }: { baseId: string; table: TableDto }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [showIssues, setShowIssues] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const refreshBase = () => qc.invalidateQueries({ queryKey: ["bases", baseId] });
  const run = useMutation({
    mutationFn: () => syncApi.runNow(baseId, table.id),
    onSuccess: async (res) => {
      await refreshBase();
      if (res.alreadyRunning) toast.success("This table is already syncing");
    },
    onError: (err) => toast.error(err, "Could not sync"),
  });
  const stop = useMutation({
    mutationFn: () => syncApi.stopRun(baseId, table.id),
    onSuccess: () => void refreshBase(),
    onError: (err) => toast.error(err, "Could not stop the sync"),
  });
  const setStatus = useMutation({
    mutationFn: (status: "active" | "paused") => syncApi.update(baseId, table.id, { status }),
    onSuccess: async (res) => {
      await refreshBase();
      toast.success(res.sync.status === "paused" ? "Sync paused" : "Sync resumed");
    },
    onError: (err) => toast.error(err, "Could not change the sync"),
  });
  const toggleTwoWay = useMutation({
    mutationFn: (twoWay: boolean) => syncApi.update(baseId, table.id, { twoWay }),
    onSuccess: async (res) => {
      await refreshBase();
      toast.success(res.sync.twoWay ? "Two-way sync on: edits here update HubSpot" : "Two-way sync off");
    },
    onError: (err) => toast.error(err, "Could not change two-way sync"),
  });
  const s = table.sync;
  const running = Boolean(s?.running);
  const firstRun = Boolean(s && !s.lastSyncedAt);
  // While a run is going (or the first one hasn't finished), keep the bar and the records fresh.
  useEffect(() => {
    if (!running && !firstRun) return;
    const t = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["bases", baseId] }, { cancelRefetch: false });
      void qc.invalidateQueries({ queryKey: ["records", baseId, table.id] }, { cancelRefetch: false });
    }, 2_000);
    return () => clearInterval(t);
  }, [running, firstRun, qc, baseId, table.id]);
  const lastSyncedAt = s?.lastSyncedAt ?? null;
  useEffect(() => {
    if (lastSyncedAt) void qc.invalidateQueries({ queryKey: ["records", baseId, table.id] });
  }, [lastSyncedAt, qc, baseId, table.id]);
  if (!s) return null;
  const p = s.progress;
  const progressText = !p
    ? "starting…"
    : p.phase === "reading"
      ? `reading ${n(p.done)} record${p.done === 1 ? "" : "s"} from the source…`
      : p.total
        ? `saving ${n(Math.min(p.done, p.total))} of ${n(p.total)} changes…`
        : "saving…";
  const issues = s.issueCount ?? 0;
  return (
    <div className={styles.syncBar} data-state={running ? "running" : s.status} role="status">
      <span aria-hidden>{s.twoWay ? "⇄" : "→"}</span>
      <span>
        {s.twoWay ? "Two-way sync with" : "Synced from"} <strong>{s.sourceBaseName ?? "another base"}</strong> ›{" "}
        <strong>{s.sourceTableName ?? "a table"}</strong>
        {" · "}
        {running ? (
          <span data-testid="sync-progress">{s.stopRequested ? "stopping…" : `syncing: ${progressText}`}</span>
        ) : s.status === "paused" ? (
          "paused"
        ) : s.status === "error" ? (
          <span className={styles.syncErr}>failed: {s.lastError}</span>
        ) : firstRun ? (
          "first sync in progress…"
        ) : (
          `updated ${ago(s.lastSyncedAt, now)}`
        )}
        {!running && s.status !== "error" && s.lastError ? (
          <>
            {" · "}
            <span className={styles.syncErr}>{s.lastError}</span>
          </>
        ) : null}
        {issues > 0 ? (
          <>
            {" · "}
            <button type="button" className={styles.syncLink} onClick={() => setShowIssues(true)}>
              {n(issues)} value{issues === 1 ? "" : "s"} couldn’t be synced — review
            </button>
          </>
        ) : null}
        {running ? null : (
          <>
            {" · "}
            {s.twoWay
              ? `edits to ${s.editableFieldIds.length} synced field${s.editableFieldIds.length === 1 ? "" : "s"} are written back to the source.`
              : "synced fields are read-only here; fields you add stay editable."}
          </>
        )}
      </span>
      {s.provider === "hubspot" ? (
        <label className={styles.syncToggle} title="Write edits to synced fields back to HubSpot">
          <input type="checkbox" checked={s.twoWay} disabled={toggleTwoWay.isPending} onChange={(e) => toggleTwoWay.mutate(e.target.checked)} />
          Two-way
        </label>
      ) : null}
      <span className={styles.syncActions}>
        {running ? (
          <button type="button" className={styles.syncBtn} onClick={() => stop.mutate()} disabled={stop.isPending || s.stopRequested}>
            {s.stopRequested ? "Stopping…" : "Stop"}
          </button>
        ) : (
          <button type="button" className={styles.syncBtn} onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Starting…" : "Sync now"}
          </button>
        )}
        {s.status === "paused" ? (
          <button type="button" className={styles.syncBtn} onClick={() => setStatus.mutate("active")} disabled={setStatus.isPending}>
            Resume
          </button>
        ) : (
          <button
            type="button"
            className={styles.syncBtn}
            onClick={() => setStatus.mutate("paused")}
            disabled={setStatus.isPending}
            title="Stop automatic syncing (and the run in progress) until you resume"
          >
            Pause
          </button>
        )}
      </span>
      {showIssues ? <SyncIssuesDialog baseId={baseId} table={table} onClose={() => setShowIssues(false)} /> : null}
    </div>
  );
}
