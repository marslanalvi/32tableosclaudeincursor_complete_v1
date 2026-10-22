import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiProblemError, type BaseDetail } from "../../lib/api.ts";
import { fieldsApi } from "../../lib/api-areas/fields.ts";
import { importRows } from "../../lib/api-areas/collab.ts";
import s from "../share/surface.module.css";
import { convertValue, detectType, parseFile, parseDelimited, toSheet, type DetectedType } from "./parse.ts";

type Step = "source" | "map" | "run" | "done";

const NEW_FIELD = "__new__";
const SKIP = "__skip__";
const CHUNK = 100;

/** A row the server rejected, kept so the user can fix it or import it without the bad value. */
interface FailedRow {
  /** Index in sheet.rows. */
  index: number;
  /** Row number in the file (as shown to the user). */
  line: number;
  message: string;
  /** Field that rejected its value, when the server says. */
  fieldId?: string | undefined;
  /** What was sent for this row, keyed by field id. */
  values: Record<string, unknown>;
  /** Editable text for the rejected value. */
  edit: string;
}

const TYPE_LABELS: Record<string, string> = {
  text: "Single line text",
  long_text: "Long text",
  number: "Number",
  currency: "Currency",
  percent: "Percent",
  checkbox: "Checkbox",
  date: "Date",
  datetime: "Date & time",
  email: "Email",
  url: "URL",
  phone: "Phone",
  single_select: "Single select",
  multi_select: "Multiple select",
};

const WRITABLE_TYPES = new Set([
  "text", "long_text", "email", "url", "phone", "number", "currency", "percent", "rating",
  "duration", "checkbox", "date", "datetime", "single_select", "multi_select", "link",
  "collaborator", "barcode",
]);

interface ColumnMap {
  target: string; // field id | NEW_FIELD | SKIP
  newName: string;
  newType: DetectedType;
  /** With NEW_FIELD: delete the existing field of the same name first, then create this one. */
  replace?: boolean;
}

type MatchChoice = "existing" | "new" | "replace" | "skip" | "other";

/** `name`, or `name 2`, `name 3`… so it matches none of `taken` (lower-cased names). */
function uniqueName(name: string, taken: Set<string>): string {
  const base = name.trim() || "Field";
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Most decimal places used in a numeric column (0–8), so 0.0079 doesn't display as 0. */
function decimalsIn(rows: string[][], col: number): number {
  let max = 0;
  for (const r of rows) {
    const m = /\.(\d+)\s*$/.exec((r[col] ?? "").trim().replace(/e[+-]?\d+$/i, ""));
    if (m) max = Math.max(max, m[1]!.replace(/0+$/, "").length);
    if (max >= 8) return 8;
  }
  return max;
}

function errorText(err: unknown): string {
  if (err instanceof ApiProblemError) return err.problem.detail ?? err.problem.title;
  const msg = err instanceof Error ? err.message : "";
  if (!msg || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Could not reach the TableOS API. Check that the server is running and try again.";
  }
  return msg;
}

/**
 * Import wizard (CONTRACTS §10): file → destination + column mapping with
 * preview → batched import with progress → summary with downloadable errors.
 */
export function ImportWizard({
  baseId,
  tableId,
  onClose,
  onDone,
  onImported,
}: {
  baseId: string;
  tableId?: string;
  onClose: () => void;
  onDone?: () => void;
  onImported?: (tableId: string) => void;
}) {
  const qc = useQueryClient();
  const baseQuery = useQuery({ queryKey: ["bases", baseId], queryFn: () => api.getBase(baseId) });
  const tables = (baseQuery.data as BaseDetail | undefined)?.tables ?? [];

  const [step, setStep] = useState<Step>("source");
  const [fileName, setFileName] = useState("");
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [pasted, setPasted] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [dest, setDest] = useState<"existing" | "new">(tableId ? "existing" : "new");
  const [destTableId, setDestTableId] = useState<string>(tableId ?? "");
  const [newTableName, setNewTableName] = useState("");
  const [mapping, setMapping] = useState<ColumnMap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, imported: 0, failed: 0 });
  const [rowErrors, setRowErrors] = useState<FailedRow[]>([]);
  const [stopped, setStopped] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** From the last run: field types and the import job, for retries. */
  const runInfo = useRef<{ tableId: string; typeOf: Map<string, string>; fieldName: Map<string, string>; colOf: Map<string, number> } | null>(null);
  const [resultTableId, setResultTableId] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "run") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  useEffect(() => {
    if (!destTableId && tables[0] && dest === "existing") setDestTableId(tables[0].id);
  }, [tables, destTableId, dest]);

  const sheet = useMemo(() => (grid ? toSheet(grid, hasHeader) : null), [grid, hasHeader]);
  const destTable = tables.find((t) => t.id === destTableId);

  /** A column goes into the existing field with the same name, otherwise into a new field. */
  const defaultTarget = useCallback(
    (header: string) => {
      const fields = dest === "existing" ? (destTable?.fields ?? []) : [];
      const match = fields.find(
        (f) => f.name.trim().toLowerCase() === header.trim().toLowerCase() && WRITABLE_TYPES.has(f.type),
      );
      return match ? match.id : NEW_FIELD;
    },
    [dest, destTable],
  );

  /** Existing field with the same name as a column (destination table only). */
  const matchFor = useCallback(
    (header: string) =>
      dest === "existing"
        ? (destTable?.fields ?? []).find((f) => f.name.trim().toLowerCase() === header.trim().toLowerCase())
        : undefined,
    [dest, destTable],
  );

  // A new table starts with its Record ID field.
  const existingNames = useMemo(
    () => new Set(dest === "existing" ? (destTable?.fields ?? []).map((f) => f.name.trim().toLowerCase()) : ["record id"]),
    [dest, destTable],
  );

  // (Re)build the default mapping whenever the source or destination changes. New fields get
  // names that clash with nothing (e.g. "Attachments 2" next to the table's Attachments field).
  useEffect(() => {
    if (!sheet) return;
    const taken = new Set(existingNames);
    setMapping(
      sheet.headers.map((header, i) => {
        // Look at the whole column (evenly sampled when huge): one odd value late in the file
        // would otherwise fail its entire row against a stricter type.
        const step = Math.max(1, Math.ceil(sheet.rows.length / 5000));
        const sample: string[] = [];
        for (let r = 0; r < sheet.rows.length; r += step) sample.push(sheet.rows[r]?.[i] ?? "");
        const target = defaultTarget(header);
        const newName = target === NEW_FIELD ? uniqueName(header, taken) : header;
        if (target === NEW_FIELD) taken.add(newName.toLowerCase());
        return { target, newName, newType: detectType(sample) };
      }),
    );
  }, [sheet, defaultTarget, existingNames]);

  const importAll = () =>
    setMapping((old) =>
      old.map((m, i) => (m.target === SKIP ? { ...m, target: defaultTarget(sheet?.headers[i] ?? m.newName) } : m)),
    );
  const skipAll = () => setMapping((old) => old.map((m) => ({ ...m, target: SKIP })));

  async function loadFile(file: File) {
    setError(null);
    setParsing(true);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) throw new Error("The file is empty.");
      setGrid(rows);
      setFileName(file.name);
      if (!newTableName) setNewTableName(file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Imported table");
      setStep("map");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setParsing(false);
    }
  }

  function usePasted() {
    const rows = parseDelimited(pasted);
    if (rows.length === 0) {
      setError("Paste some CSV data first.");
      return;
    }
    setGrid(rows);
    setFileName("pasted.csv");
    if (!newTableName) setNewTableName("Imported table");
    setStep("map");
  }

  const mappedCount = mapping.filter((m) => m.target !== SKIP).length;
  const headers = sheet?.headers ?? [];
  const matches = headers.map((h) => matchFor(h));
  /** Fields that will be deleted because a column replaces them. */
  const replacedIds = new Set(
    mapping.flatMap((m, i) => (m.target === NEW_FIELD && m.replace && matches[i] ? [matches[i]!.id] : [])),
  );
  const freeNames = new Set(
    dest === "existing"
      ? (destTable?.fields ?? []).filter((f) => !replacedIds.has(f.id)).map((f) => f.name.trim().toLowerCase())
      : existingNames,
  );
  /** Per column: why its choice can't be imported, or null. */
  const nameProblems = mapping.map((m, i) => {
    if (m.target !== NEW_FIELD && replacedIds.has(m.target)) {
      return "That field is being replaced by another column. Pick a different field.";
    }
    if (m.target !== NEW_FIELD) return null;
    const n = m.newName.trim().toLowerCase();
    if (!n) return "Give the new field a name.";
    if (freeNames.has(n)) return `“${m.newName.trim()}” already exists in this table. Rename it, or choose another option.`;
    if (mapping.some((o, j) => j < i && o.target === NEW_FIELD && o.newName.trim().toLowerCase() === n)) {
      return `Another column already creates “${m.newName.trim()}”. Give this one a different name.`;
    }
    return null;
  });
  const duplicateNames = nameProblems.some(Boolean);
  const renameClashes = () =>
    setMapping((old) => {
      const taken = new Set(freeNames);
      return old.map((m) => {
        if (m.target !== NEW_FIELD) return m;
        const newName = uniqueName(m.newName, taken);
        taken.add(newName.toLowerCase());
        return newName === m.newName ? m : { ...m, newName };
      });
    });
  const matchedColumns = headers.filter((_, i) => matches[i]).length;
  const canRun =
    Boolean(sheet && sheet.rows.length > 0 && mappedCount > 0) &&
    !duplicateNames &&
    (dest === "new" ? newTableName.trim().length > 0 : Boolean(destTable)) &&
    mapping.every((m) => m.target !== NEW_FIELD || m.newName.trim().length > 0);

  const choiceOf = (m: ColumnMap, i: number): MatchChoice => {
    const match = matches[i];
    if (m.target === SKIP) return "skip";
    if (m.target === NEW_FIELD) return m.replace ? "replace" : "new";
    return match && m.target === match.id ? "existing" : "other";
  };
  const choose = (i: number, choice: MatchChoice) =>
    setMapping((old) =>
      old.map((m, j) => {
        if (j !== i) return m;
        const match = matches[i];
        const header = headers[i] ?? m.newName;
        switch (choice) {
          case "existing":
            return match ? { ...m, target: match.id, replace: false } : m;
          case "replace":
            return { ...m, target: NEW_FIELD, replace: true, newName: match?.name ?? header };
          case "new": {
            const taken = new Set(freeNames);
            old.forEach((o, k) => k !== i && o.target === NEW_FIELD && taken.add(o.newName.trim().toLowerCase()));
            const keep = m.target === NEW_FIELD && !m.replace && !taken.has(m.newName.trim().toLowerCase());
            return { ...m, target: NEW_FIELD, replace: false, newName: keep ? m.newName : uniqueName(header, taken) };
          }
          case "skip":
            return { ...m, target: SKIP, replace: false };
          default: {
            const other = (destTable?.fields ?? []).find((f) => WRITABLE_TYPES.has(f.type) && f.id !== match?.id);
            return other ? { ...m, target: other.id, replace: false } : m;
          }
        }
      }),
    );

  async function run() {
    if (!sheet) return;
    setError(null);
    setStep("run");
    cancelRef.current = false;
    setStopped(false);
    abortRef.current = new AbortController();
    setRowErrors([]);
    setProgress({ done: 0, total: sheet.rows.length, imported: 0, failed: 0 });
    try {
      // 1) Destination table.
      let targetTableId = destTableId;
      let fields = destTable?.fields ?? [];
      const effective = mapping.map((m) => ({ ...m }));
      if (dest === "new") {
        const created = await api.createTable(baseId, newTableName.trim(), { starter: false });
        targetTableId = created.table.id;
        const fresh = await api.getBase(baseId);
        const t = fresh.tables.find((x) => x.id === targetTableId);
        fields = t?.fields ?? [];
        // A Record ID primary stays; every column becomes its own field. Otherwise the first column fills the primary.
        const primary = t?.fields.find((f) => f.id === t.primaryFieldId) ?? t?.fields[0];
        const firstNew = effective.findIndex((m) => m.target === NEW_FIELD);
        if (primary && primary.type !== "record_id" && firstNew >= 0) {
          const m = effective[firstNew]!;
          const primaryType = ["text", "long_text", "email", "url", "phone", "number", "date"].includes(m.newType)
            ? m.newType
            : "text";
          try {
            await fieldsApi.update(baseId, targetTableId, primary.id, {
              name: m.newName.trim(),
              ...(primaryType !== primary.type ? { type: primaryType } : {}),
            });
          } catch {
            await fieldsApi.update(baseId, targetTableId, primary.id, { name: m.newName.trim() });
          }
          m.target = primary.id;
          m.newType = primaryType as DetectedType;
        }
      }
      // 2) Fields the user chose to replace go first, so their names are free again.
      if (dest === "existing") {
        for (const [col, m] of effective.entries()) {
          const match = matches[col];
          if (m.target !== NEW_FIELD || !m.replace || !match) continue;
          await fieldsApi.remove(baseId, targetTableId, match.id);
          fields = fields.filter((f) => f.id !== match.id);
        }
      }
      // 3) New fields.
      const typeOf = new Map(fields.map((f) => [f.id, f.type]));
      for (const [col, m] of effective.entries()) {
        if (m.target !== NEW_FIELD) continue;
        const config =
          m.newType === "single_select" || m.newType === "multi_select"
            ? { config: { options: [] } }
            : m.newType === "number"
              ? { config: { precision: decimalsIn(sheet.rows, col) } }
              : {};
        const f = await fieldsApi.create(baseId, targetTableId, { name: m.newName.trim(), type: m.newType, ...config });
        m.target = f.id;
        typeOf.set(f.id, f.type);
      }
      for (const m of effective) {
        if (m.target !== SKIP && m.target !== NEW_FIELD && !typeOf.has(m.target)) typeOf.set(m.target, m.newType);
      }
      await qc.invalidateQueries({ queryKey: ["bases", baseId] });

      // 4) Rows in chunks.
      let importJobId: string | undefined;
      let imported = 0;
      let failed = 0;
      const errs: FailedRow[] = [];
      const firstDataRow = hasHeader ? 2 : 1;
      const colOf = new Map<string, number>();
      effective.forEach((m, col) => m.target !== SKIP && colOf.set(m.target, col));
      const freshFields = (await api.getBase(baseId)).tables.find((t) => t.id === targetTableId)?.fields ?? [];
      runInfo.current = { tableId: targetTableId, typeOf, fieldName: new Map(freshFields.map((f) => [f.id, f.name])), colOf };
      for (let i = 0; i < sheet.rows.length; i += CHUNK) {
        if (cancelRef.current) break;
        const slice = sheet.rows.slice(i, i + CHUNK);
        const rows = slice.map((r) => {
          const out: Record<string, unknown> = {};
          effective.forEach((m, col) => {
            if (m.target === SKIP) return;
            const v = convertValue(typeOf.get(m.target) ?? "text", r[col] ?? "");
            if (v !== undefined) out[m.target] = v;
          });
          return out;
        });
        const res = await importRows(
          baseId,
          {
            tableId: targetTableId,
            rows,
            filename: fileName,
            rowOffset: i,
            typecast: true,
            final: i + CHUNK >= sheet.rows.length,
            ...(importJobId ? { importJobId } : { totalRows: sheet.rows.length }),
          },
          abortRef.current?.signal,
        );
        importJobId = res.importJobId;
        imported += res.rowsImported;
        failed += res.rowsFailed;
        for (const e of res.errors) {
          const index = e.row - 1;
          const col = e.field ? colOf.get(e.field) : undefined;
          errs.push({
            index,
            line: e.row + firstDataRow - 1,
            message: e.message,
            fieldId: e.field,
            values: rows[index - i] ?? {},
            edit: col !== undefined ? (sheet.rows[index]?.[col] ?? "") : "",
          });
        }
        setRowErrors([...errs]);
        setProgress({ done: Math.min(i + CHUNK, sheet.rows.length), total: sheet.rows.length, imported, failed });
      }
      setResultTableId(targetTableId);
      await qc.invalidateQueries({ queryKey: ["bases", baseId] });
      await qc.invalidateQueries({ queryKey: ["records", baseId] });
      onDone?.();
      setStep("done");
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      setError(errorText(err));
      setStep("done");
    }
  }

  /** Stop right away: the request in flight is abandoned and the summary shows at once. */
  function stopNow() {
    cancelRef.current = true;
    abortRef.current?.abort();
    setStopped(true);
    setStep("done");
    if (runInfo.current) setResultTableId(runInfo.current.tableId);
    void qc.invalidateQueries({ queryKey: ["records", baseId] });
    onDone?.();
  }

  /**
   * Import the failed rows again: "fixed" uses the edited values, "blank" leaves the rejected
   * value empty so the rest of the row still comes in.
   */
  async function retryFailed(mode: "fixed" | "blank") {
    const info = runInfo.current;
    if (!info || rowErrors.length === 0) return;
    setRetrying(true);
    setError(null);
    try {
      const pending = rowErrors.map((f) => {
        const values = { ...f.values };
        if (f.fieldId) {
          if (mode === "blank") delete values[f.fieldId];
          else {
            const v = convertValue(info.typeOf.get(f.fieldId) ?? "text", f.edit);
            if (v === undefined) delete values[f.fieldId];
            else values[f.fieldId] = v;
          }
        }
        return { ...f, values };
      });
      const still: FailedRow[] = [];
      let ok = 0;
      for (let i = 0; i < pending.length; i += CHUNK) {
        const chunk = pending.slice(i, i + CHUNK);
        const res = await importRows(baseId, { tableId: info.tableId, rows: chunk.map((c) => c.values), filename: fileName, typecast: true, final: true });
        ok += res.rowsImported;
        const failedIdx = new Map(res.errors.map((e) => [e.row - 1, e]));
        chunk.forEach((c, k) => {
          const e = failedIdx.get(k);
          if (!e) return;
          const col = e.field ? info.colOf.get(e.field) : undefined;
          still.push({ ...c, message: e.message, fieldId: e.field, edit: col !== undefined && e.field !== c.fieldId ? (sheet?.rows[c.index]?.[col] ?? "") : c.edit });
        });
      }
      setRowErrors(still);
      setProgress((p) => ({ ...p, imported: p.imported + ok, failed: still.length }));
      await qc.invalidateQueries({ queryKey: ["records", baseId] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRetrying(false);
    }
  }

  function downloadErrors() {
    const name = (id?: string) => (id ? (runInfo.current?.fieldName.get(id) ?? "") : "");
    const lines = [["Row", "Column", "Value", "Error"], ...rowErrors.map((e) => [String(e.line), name(e.fieldId), e.edit, e.message])]
      .map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const stepIndex = { source: 0, map: 1, run: 2, done: 2 }[step];

  return (
    <div className={s.backdrop} role="presentation" onMouseDown={step === "run" ? undefined : onClose}>
      <div
        className={s.dialogWide}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s.header}>
          <div style={{ flex: 1 }}>
            <h2 id="import-title" className={s.title}>
              Import data
            </h2>
            <p className={s.subtitle}>CSV, TSV or Excel (.xlsx). The first worksheet is imported.</p>
          </div>
          {step !== "run" ? (
            <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
        <div className={s.steps} aria-label="Progress">
          {["Choose file", "Map fields", "Import"].map((label, i) => (
            <span key={label} className={i === stepIndex ? s.stepActive : s.step}>
              <span className={s.stepNum}>{i + 1}</span>
              {label}
              {i < 2 ? <span aria-hidden style={{ margin: "0 4px" }}>›</span> : null}
            </span>
          ))}
        </div>

        {step === "source" ? (
          <>
            <div className={s.body}>
              {error ? <p className={s.error}>{error}</p> : null}
              <div
                className={dragging ? s.dropzoneActive : s.dropzone}
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void loadFile(f);
                }}
              >
                <div className={s.settingTitle}>{parsing ? "Reading file…" : "Drop a file here, or click to browse"}</div>
                <p className={s.hint} style={{ marginTop: 4 }}>
                  .csv, .tsv, .txt or .xlsx
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void loadFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <div>
                <label className={s.label} htmlFor="import-paste">
                  Or paste CSV
                </label>
                <textarea
                  id="import-paste"
                  className={s.textarea}
                  value={pasted}
                  rows={5}
                  placeholder={"Name,Email\nAda Lovelace,ada@example.com"}
                  onChange={(e) => setPasted(e.target.value)}
                />
              </div>
            </div>
            <div className={s.footer}>
              <button type="button" className={s.btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={s.btnPrimary} disabled={!pasted.trim()} onClick={usePasted}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "map" && sheet ? (
          <>
            <div className={s.body}>
              {error ? <p className={s.error}>{error}</p> : null}
              <div className={s.row} style={{ gap: 12, flexWrap: "wrap" }}>
                <label className={dest === "new" ? s.radioCardActive : s.radioCard} style={{ flex: 1, minWidth: 220 }}>
                  <input type="radio" checked={dest === "new"} onChange={() => setDest("new")} />
                  <span>
                    <span className={s.settingTitle}>Create a new table</span>
                    <input
                      className={s.input}
                      style={{ marginTop: 8 }}
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      onFocus={() => setDest("new")}
                      aria-label="New table name"
                    />
                  </span>
                </label>
                <label
                  className={dest === "existing" ? s.radioCardActive : s.radioCard}
                  style={{ flex: 1, minWidth: 220 }}
                >
                  <input
                    type="radio"
                    checked={dest === "existing"}
                    disabled={tables.length === 0}
                    onChange={() => setDest("existing")}
                  />
                  <span style={{ flex: 1 }}>
                    <span className={s.settingTitle}>Append to an existing table</span>
                    <select
                      className={s.select}
                      style={{ marginTop: 8 }}
                      value={destTableId}
                      onChange={(e) => {
                        setDestTableId(e.target.value);
                        setDest("existing");
                      }}
                      aria-label="Destination table"
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              </div>
              <label className={s.row} style={{ fontSize: 14 }}>
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                First row contains field names
              </label>
              <div className={s.row} style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <p className={s.hint} style={{ margin: 0 }}>
                  {fileName} · {sheet.rows.length.toLocaleString()} row{sheet.rows.length === 1 ? "" : "s"} ·{" "}
                  {sheet.headers.length} column{sheet.headers.length === 1 ? "" : "s"}
                </p>
                <span className={s.row} style={{ gap: 8 }}>
                  <button
                    type="button"
                    className={s.btnSecondary}
                    style={{ minHeight: 30, padding: "4px 12px" }}
                    disabled={mappedCount === sheet.headers.length}
                    onClick={importAll}
                    title="Map every column: to the field with the same name, or to a new field"
                  >
                    Import all
                  </button>
                  <button type="button" className={s.btnSecondary} style={{ minHeight: 30, padding: "4px 12px" }} disabled={mappedCount === 0} onClick={skipAll}>
                    Don’t import any
                  </button>
                </span>
              </div>
              {matchedColumns ? (
                <div className={s.matchBanner} role="note">
                  <strong>
                    {matchedColumns === 1 ? "1 column has" : `${matchedColumns} columns have`} the same name as a field already in “{destTable?.name}”:
                  </strong>{" "}
                  {headers.filter((_, i) => matches[i]).join(", ")}. They’re highlighted below. For each one, choose whether to import into the
                  existing field, import as a new field with another name, replace the existing field, or not import it.
                </div>
              ) : null}
              {duplicateNames ? (
                <div className={s.error} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span>
                    {nameProblems.filter(Boolean).length === 1 ? "One column needs" : `${nameProblems.filter(Boolean).length} columns need`} your attention
                    (marked in red below).
                  </span>
                  <button type="button" className={s.btnSecondary} style={{ minHeight: 28, padding: "2px 10px" }} onClick={renameClashes}>
                    Rename them for me
                  </button>
                </div>
              ) : null}
              <div style={{ overflowX: "auto", border: "1px solid var(--tableos-color-border)", borderRadius: 10 }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th style={{ width: "22%" }}>Column</th>
                      <th style={{ width: "40%" }}>Import into</th>
                      <th>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.headers.map((header, i) => {
                      const m = mapping[i];
                      if (!m) return null;
                      const set = (patch: Partial<ColumnMap>) =>
                        setMapping((old) => old.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                      const match = matches[i];
                      const choice = choiceOf(m, i);
                      const canInto = Boolean(match && WRITABLE_TYPES.has(match.type));
                      const canReplace = Boolean(match && match.id !== destTable?.primaryFieldId);
                      const matchType = match ? (TYPE_LABELS[match.type] ?? match.type.replace(/_/g, " ")) : "";
                      const radio = (value: MatchChoice, label: ReactNode, disabled = false, why?: string) => (
                        <label className={s.matchOption} data-disabled={disabled || undefined} title={why}>
                          <input
                            type="radio"
                            name={`match-${i}`}
                            checked={choice === value}
                            disabled={disabled}
                            onChange={() => choose(i, value)}
                          />
                          <span>
                            {label}
                            {disabled && why ? <span className={s.matchWhy}> {why}</span> : null}
                          </span>
                        </label>
                      );
                      const newFieldInputs =
                        m.target === NEW_FIELD ? (
                          <div className={s.row} style={{ marginTop: 6 }}>
                            <input
                              className={s.input}
                              value={m.newName}
                              onChange={(e) => set({ newName: e.target.value })}
                              aria-label="New field name"
                              aria-invalid={nameProblems[i] ? true : undefined}
                              style={nameProblems[i] ? { borderColor: "var(--tableos-color-danger)", boxShadow: "0 0 0 1px var(--tableos-color-danger)" } : undefined}
                            />
                            <select
                              className={s.select}
                              value={m.newType}
                              onChange={(e) => set({ newType: e.target.value as DetectedType })}
                              aria-label="New field type"
                            >
                              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null;
                      if (match) {
                        return (
                          <tr key={`${header}-${i}`} className={s.matchRow} data-testid="import-match">
                            <td>
                              <strong style={{ fontWeight: 500 }}>{header}</strong>
                              <div className={s.matchTag}>Same name as an existing field</div>
                            </td>
                            <td>
                              <div className={s.matchChoices} role="radiogroup" aria-label={`What to do with ${header}`}>
                                {radio(
                                  "existing",
                                  <>
                                    Import into the existing “{match.name}” field <span className={s.muted}>({matchType})</span>
                                  </>,
                                  !canInto,
                                  canInto ? undefined : `(${matchType} fields can’t take imported values)`,
                                )}
                                {radio("new", "Import as a new field, with a name I choose")}
                                {choice === "new" ? newFieldInputs : null}
                                {radio(
                                  "replace",
                                  <>
                                    Replace: delete the existing “{match.name}” field and import this column in its place
                                  </>,
                                  !canReplace,
                                  canReplace ? undefined : "(the primary field can’t be deleted)",
                                )}
                                {choice === "replace" ? newFieldInputs : null}
                                {choice === "replace" ? (
                                  <div className={s.matchWhy}>
                                    The current “{match.name}” field and its values are deleted when you import (Undo brings it back).
                                  </div>
                                ) : null}
                                {radio("skip", "Don’t import this column")}
                                {canInto || (destTable?.fields ?? []).some((f) => WRITABLE_TYPES.has(f.type) && f.id !== match.id)
                                  ? radio("other", "Import into a different field")
                                  : null}
                                {choice === "other" ? (
                                  <select
                                    className={s.select}
                                    value={m.target}
                                    onChange={(e) => set({ target: e.target.value })}
                                    aria-label={`Field for ${header}`}
                                  >
                                    {(destTable?.fields ?? [])
                                      .filter((f) => WRITABLE_TYPES.has(f.type) && f.id !== match.id)
                                      .map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f.name} · {TYPE_LABELS[f.type] ?? f.type}
                                        </option>
                                      ))}
                                  </select>
                                ) : null}
                              </div>
                              {nameProblems[i] ? (
                                <div style={{ marginTop: 4, fontSize: 12, color: "var(--tableos-color-danger)" }}>{nameProblems[i]}</div>
                              ) : null}
                            </td>
                            <td className={s.muted}>
                              {sheet.rows
                                .slice(0, 3)
                                .map((r) => r[i] ?? "")
                                .filter((v) => v.trim())
                                .map((v) => (v.length > 40 ? `${v.slice(0, 40)}…` : v))
                                .join(" · ") || "—"}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={`${header}-${i}`}>
                          <td>
                            <strong style={{ fontWeight: 500 }}>{header}</strong>
                          </td>
                          <td>
                            <select
                              className={s.select}
                              value={m.target}
                              onChange={(e) => set({ target: e.target.value })}
                              aria-label={`Destination for ${header}`}
                            >
                              <option value={SKIP}>Don’t import</option>
                              <option value={NEW_FIELD}>+ New field</option>
                              {dest === "existing"
                                ? (destTable?.fields ?? [])
                                    .filter((f) => WRITABLE_TYPES.has(f.type))
                                    .map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name} · {TYPE_LABELS[f.type] ?? f.type}
                                      </option>
                                    ))
                                : null}
                            </select>
                            {newFieldInputs}
                            {nameProblems[i] ? (
                              <div style={{ marginTop: 4, fontSize: 12, color: "var(--tableos-color-danger)" }}>{nameProblems[i]}</div>
                            ) : null}
                          </td>
                          <td className={s.muted}>
                            {sheet.rows
                              .slice(0, 3)
                              .map((r) => r[i] ?? "")
                              .filter((v) => v.trim())
                              .map((v) => (v.length > 40 ? `${v.slice(0, 40)}…` : v))
                              .join(" · ") || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={s.footer}>
              <button
                type="button"
                className={s.btnSecondary}
                onClick={() => {
                  setGrid(null);
                  setStep("source");
                }}
              >
                Back
              </button>
              <span className={s.footerSpacer} />
              <span className={s.hint}>{mappedCount} of {sheet.headers.length} columns</span>
              <button type="button" className={s.btnPrimary} disabled={!canRun} onClick={() => void run()}>
                Import {sheet.rows.length.toLocaleString()} record{sheet.rows.length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        ) : null}

        {step === "run" || step === "done" ? (
          <>
            <div className={s.body}>
              {error ? <p className={s.error}>{error}</p> : null}
              <div className={s.cardSoft}>
                <div className={s.settingTitle}>
                  {step === "run"
                    ? `Importing… ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
                    : stopped
                      ? "Import stopped"
                      : error
                        ? "Import stopped"
                        : "Import complete"}
                </div>
                <div className={s.progressTrack} aria-hidden>
                  <div
                    className={s.progressBar}
                    style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                  />
                </div>
                <p className={s.hint}>
                  {progress.imported.toLocaleString()} imported
                  {rowErrors.length ? ` · ${rowErrors.length.toLocaleString()} need your attention` : ""}
                  {stopped
                    ? ` · stopped at row ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}. Rows that were already being saved when you pressed Stop may also appear.`
                    : ""}
                </p>
              </div>
              {rowErrors.length && step === "done" ? (
                <div data-testid="import-invalid">
                  <div className={s.row} style={{ justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap" }}>
                    <span className={s.settingTitle}>
                      Entries that couldn’t be imported ({rowErrors.length.toLocaleString()})
                    </span>
                    <button type="button" className={s.btnText} onClick={downloadErrors}>
                      Download as CSV
                    </button>
                  </div>
                  <p className={s.hint} style={{ marginTop: 0 }}>
                    These values don’t fit their field (wrong format or type). Correct them below and import again, import those rows with
                    the invalid value left empty, or skip them.
                  </p>
                  <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--tableos-color-border)", borderRadius: 10 }}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>Row</th>
                          <th style={{ width: "22%" }}>Column</th>
                          <th style={{ width: "30%" }}>Value</th>
                          <th>Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowErrors.slice(0, 200).map((e, k) => (
                          <tr key={`${e.index}-${e.fieldId ?? ""}`} data-testid="import-invalid-row">
                            <td>{e.line}</td>
                            <td>{e.fieldId ? (runInfo.current?.fieldName.get(e.fieldId) ?? "—") : "—"}</td>
                            <td>
                              {e.fieldId ? (
                                <input
                                  className={s.input}
                                  value={e.edit}
                                  aria-label={`Value in row ${e.line}`}
                                  onChange={(ev) => setRowErrors((old) => old.map((x, j) => (j === k ? { ...x, edit: ev.target.value } : x)))}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>{e.message.replace(/^[^:]+: /, "")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rowErrors.length > 200 ? <p className={s.hint}>Showing the first 200; the CSV has all of them.</p> : null}
                  <div className={s.row} style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button type="button" className={s.btnPrimary} disabled={retrying} onClick={() => void retryFailed("fixed")}>
                      {retrying ? "Importing…" : "Import with my corrections"}
                    </button>
                    <button type="button" className={s.btnSecondary} disabled={retrying} onClick={() => void retryFailed("blank")}>
                      Import them with the invalid values left empty
                    </button>
                    <button type="button" className={s.btnText} disabled={retrying} onClick={() => setRowErrors([])}>
                      Skip these rows
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className={s.footer}>
              {step === "run" ? (
                <button type="button" className={s.btnSecondary} onClick={stopNow}>
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  className={s.btnPrimary}
                  onClick={() => {
                    if (resultTableId) onImported?.(resultTableId);
                    onClose();
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
