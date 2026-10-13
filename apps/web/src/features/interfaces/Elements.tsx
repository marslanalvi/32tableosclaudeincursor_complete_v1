import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { cellValueToText } from "@tabula/field-ui";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "../../app/ui.tsx";
import { ApiProblemError, type FieldDto, type TableDto } from "../../lib/api.ts";
import {
  interfacesApi,
  type CollectionConfig,
  type DatePreset,
  type DateRange,
  type ElementField,
  type ElementRecord,
  type InterfaceElement,
  type InterfacePage,
} from "../../lib/api-areas/interfaces.ts";
import { viewRecordsApi } from "../../lib/api-areas/views.ts";
import { CellValueDisplay, ValueEditor } from "../views/field-value.tsx";
import { FormPreview } from "../views/FormView.tsx";
import { isEditableField } from "../views/view-utils.ts";
import { ChartElement } from "./Charts.tsx";
import styles from "./interfaces.module.css";

export interface DateFilterState {
  preset: DatePreset;
  from?: string | null;
  to?: string | null;
}

export interface RenderCtx {
  baseId: string;
  interfaceId: string;
  pageId: string;
  /** Builders preview the saved draft; everyone else reads the published snapshot. */
  draft: boolean;
  /** Changes whenever the server-side layout changes, so element queries refetch. */
  token: string | number;
  tables: TableDto[];
  pages: InterfacePage[];
  elements: InterfaceElement[];
  selections: Record<string, string>;
  select: (elementId: string, recordId: string | null) => void;
  /** Date filter element id → chosen range; absent means the element's default preset. */
  dateFilters: Record<string, DateFilterState>;
  setDateFilter: (elementId: string, state: DateFilterState) => void;
  navigate: (pageId: string) => void;
  editing: boolean;
  canWrite: boolean;
}

export function errorText(err: unknown): string {
  if (err instanceof ApiProblemError) return err.problem.detail ?? err.problem.title;
  return err instanceof Error ? err.message : "Something went wrong";
}

export function tableOf(ctx: RenderCtx, tableId: string | undefined): TableDto | undefined {
  return ctx.tables.find((t) => t.id === tableId);
}

function resolveFields(table: TableDto | undefined, fields: ElementField[]): Array<{ ef: ElementField; field: FieldDto }> {
  if (!table) return [];
  return fields
    .map((ef) => ({ ef, field: table.fields.find((f) => f.id === ef.fieldId) }))
    .filter((x): x is { ef: ElementField; field: FieldDto } => Boolean(x.field));
}

export function Problem({ children }: { children: ReactNode }) {
  return <div className={styles.elementProblem}>{children}</div>;
}

export function ElementView({ el, ctx }: { el: InterfaceElement; ctx: RenderCtx }) {
  switch (el.type) {
    case "text":
      return <TextBlock body={el.config.body} />;
    case "divider":
      return <hr className={styles.divider} />;
    case "metric":
      return <MetricElement el={el} ctx={ctx} />;
    case "chart":
      return <ChartElement el={el} ctx={ctx} />;
    case "table":
    case "record_list":
    case "gallery":
      return <CollectionElement el={el} ctx={ctx} />;
    case "record_detail":
      return <RecordDetailElement el={el} ctx={ctx} />;
    case "form":
      return <FormElement el={el} ctx={ctx} />;
    case "button":
      return <ButtonElement el={el} ctx={ctx} />;
    case "date_filter":
      return <DateFilterElement el={el} ctx={ctx} />;
  }
}

/* ------------------------------------------------------------------ */
/* Date filters */

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  all: "All time",
  today: "Today",
  last_7: "Last 7 days",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  this_month: "This month",
  last_month: "Last month",
  this_year: "This year",
  custom: "Custom range",
};

/** Inclusive bounds of a preset, in the viewer's calendar. */
export function presetRange(preset: DatePreset, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const back = (days: number) => ({ from: localDay(new Date(y, m, now.getDate() - days)), to: localDay(now) });
  switch (preset) {
    case "today":
      return back(0);
    case "last_7":
      return back(6);
    case "last_30":
      return back(29);
    case "last_90":
      return back(89);
    case "this_month":
      return { from: localDay(new Date(y, m, 1)), to: localDay(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: localDay(new Date(y, m - 1, 1)), to: localDay(new Date(y, m, 0)) };
    case "this_year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    default:
      return {};
  }
}

function filterStateOf(el: Extract<InterfaceElement, { type: "date_filter" }>, ctx: RenderCtx): DateFilterState {
  return ctx.dateFilters[el.id] ?? { preset: el.config.defaultPreset };
}

/** Ranges from this page's date filters on `tableId`, or undefined when none narrows anything. */
export function rangesFor(ctx: RenderCtx, tableId: string): Record<string, DateRange> | undefined {
  const out: Record<string, DateRange> = {};
  for (const e of ctx.elements) {
    if (e.type !== "date_filter" || e.config.tableId !== tableId) continue;
    const st = filterStateOf(e, ctx);
    const r = st.preset === "custom" ? { from: st.from || null, to: st.to || null } : presetRange(st.preset);
    if (r.from || r.to) out[e.id] = r;
  }
  return Object.keys(out).length ? out : undefined;
}

function DateFilterElement({ el, ctx }: { el: Extract<InterfaceElement, { type: "date_filter" }>; ctx: RenderCtx }) {
  const table = tableOf(ctx, el.config.tableId);
  const field = table?.fields.find((f) => f.id === el.config.fieldId);
  if (!table) return <Problem>This filter's table was deleted.</Problem>;
  if (!field) return <Problem>Pick a date field for this filter.</Problem>;
  const st = filterStateOf(el, ctx);
  const range = st.preset === "custom" ? { from: st.from, to: st.to } : presetRange(st.preset);
  const set = (patch: Partial<DateFilterState>) => ctx.setDateFilter(el.id, { ...st, ...patch });
  const presets = (Object.keys(DATE_PRESET_LABEL) as DatePreset[]).filter((p) => p !== "custom");
  return (
    <div className={styles.dateFilter} role="group" aria-label={`Filter by ${field.name}`}>
      {el.title ? null : <span className={styles.dateFilterLabel}>{field.name}</span>}
      <div className={styles.dateFilterChips}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.dateChip} ${st.preset === p ? styles.dateChipOn : ""}`}
            aria-pressed={st.preset === p}
            onClick={() => set({ preset: p })}
          >
            {DATE_PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <label className={styles.dateFilterRange}>
        <span className={styles.srOnly}>From</span>
        <input
          type="date"
          value={range.from ?? ""}
          max={range.to ?? undefined}
          onChange={(e) => set({ preset: "custom", from: e.target.value || null, to: range.to ?? null })}
        />
      </label>
      <span className={styles.muted}>to</span>
      <label className={styles.dateFilterRange}>
        <span className={styles.srOnly}>To</span>
        <input
          type="date"
          value={range.to ?? ""}
          min={range.from ?? undefined}
          onChange={(e) => set({ preset: "custom", to: e.target.value || null, from: range.from ?? null })}
        />
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** A small, safe markdown subset: `#`/`##`/`###` headings, `- ` bullets, `**bold**`, paragraphs. */
export function TextBlock({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul${blocks.length}`} className={styles.textList}>
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  body.split("\n").forEach((line, i) => {
    const t = line.trimEnd();
    if (/^[-*] /.test(t)) {
      bullets.push(t.slice(2));
      return;
    }
    flush();
    if (!t.trim()) return;
    const h = /^(#{1,3}) (.*)$/.exec(t);
    if (h) {
      const level = h[1]!.length;
      const cls = level === 1 ? styles.textH1 : level === 2 ? styles.textH2 : styles.textH3;
      blocks.push(
        <div key={i} className={cls} role="heading" aria-level={level + 1}>
          {inline(h[2]!)}
        </div>,
      );
    } else {
      blocks.push(
        <p key={i} className={styles.textP}>
          {inline(t)}
        </p>,
      );
    }
  });
  flush();
  return <div className={styles.text}>{blocks.length ? blocks : <p className={styles.muted}>Empty text</p>}</div>;
}

/* ------------------------------------------------------------------ */
/* Aggregates */

export function useAggregate(el: InterfaceElement, ctx: RenderCtx, tableId: string) {
  const dateRanges = rangesFor(ctx, tableId);
  return useQuery({
    queryKey: ["records", ctx.baseId, tableId, "itf-agg", ctx.interfaceId, ctx.pageId, el.id, ctx.draft, ctx.token, dateRanges],
    queryFn: () =>
      interfacesApi.aggregateElement(ctx.baseId, ctx.interfaceId, ctx.pageId, el.id, {
        draft: ctx.draft,
        ...(dateRanges ? { context: { dateRanges } } : {}),
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function formatNumber(v: unknown, format?: { style: string; precision?: number; currencyCode?: string }): string {
  const n = typeof v === "number" ? v : Number(v);
  if (v === null || v === undefined || Number.isNaN(n)) return "—";
  const precision = format?.precision ?? (Number.isInteger(n) ? 0 : 2);
  try {
    if (format?.style === "currency") {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: format.currencyCode || "USD", maximumFractionDigits: precision, minimumFractionDigits: precision }).format(n);
    }
    if (format?.style === "percent") {
      return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: precision }).format(n / 100);
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: precision, minimumFractionDigits: precision }).format(n);
  } catch {
    return String(n);
  }
}

function MetricElement({ el, ctx }: { el: Extract<InterfaceElement, { type: "metric" }>; ctx: RenderCtx }) {
  const q = useAggregate(el, ctx, el.config.source.tableId);
  const table = tableOf(ctx, el.config.source.tableId);
  const field = table?.fields.find((f) => f.id === el.config.measure.fieldId);
  const caption = el.config.measure.agg === "count" ? "records" : `${el.config.measure.agg.replace("_", " ")} of ${field?.name ?? "field"}`;
  if (!table) return <Problem>This number's table was deleted.</Problem>;
  return (
    <div className={styles.metric}>
      <div className={styles.metricValue} aria-live="polite">
        {q.isLoading
          ? "…"
          : q.isError
            ? "—"
            : formatNumber(
                q.data?.value ?? (q.data?.count === 0 && el.config.measure.agg !== "avg" && el.config.measure.agg !== "min" && el.config.measure.agg !== "max" ? 0 : null),
                el.config.format,
              )}
      </div>
      <div className={styles.metricCaption}>{q.isError ? errorText(q.error) : caption}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collections (grid / list / gallery) */

function hasDetailFor(ctx: RenderCtx, elementId: string): boolean {
  return ctx.elements.some((e) => e.type === "record_detail" && e.config.dataSource.recordContext.elementId === elementId);
}

function CollectionElement({
  el,
  ctx,
}: {
  el: Extract<InterfaceElement, { type: "table" | "record_list" | "gallery" }>;
  ctx: RenderCtx;
}) {
  const cfg: CollectionConfig = el.config;
  const table = tableOf(ctx, cfg.dataSource.tableId);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState<ElementRecord | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const dateRanges = rangesFor(ctx, cfg.dataSource.tableId);
  const q = useInfiniteQuery({
    queryKey: ["records", ctx.baseId, cfg.dataSource.tableId, "itf", ctx.interfaceId, ctx.pageId, el.id, ctx.draft, ctx.token, debounced, dateRanges],
    queryFn: ({ pageParam }) =>
      interfacesApi.queryElement(ctx.baseId, ctx.interfaceId, ctx.pageId, el.id, {
        draft: ctx.draft,
        pageSize: el.type === "gallery" ? 24 : 50,
        ...(dateRanges ? { context: { dateRanges } } : {}),
        ...(debounced ? { search: debounced } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const fields = resolveFields(table, cfg.fields);
  const titleField = table?.fields.find((f) => f.id === (cfg.titleFieldId ?? table.primaryFieldId)) ?? fields[0]?.field;
  const records = q.data?.pages.flatMap((p) => p.records) ?? [];
  const selected = ctx.selections[el.id];
  const linked = hasDetailFor(ctx, el.id);

  if (!table) return <Problem>This element's table was deleted.</Problem>;

  const activate = (rec: ElementRecord) => {
    if (cfg.selection === "single" && linked) ctx.select(el.id, rec.id);
    else if (cfg.permissions.allowOpenRecord) setOpen(rec);
  };
  const title = (rec: ElementRecord) => (titleField ? cellValueToText(titleField, rec.fields[titleField.id]) : "") || "Unnamed record";

  return (
    <div className={styles.collection}>
      {cfg.searchable || (cfg.permissions.allowCreate && ctx.canWrite) ? (
        <div className={styles.collectionBar}>
          {cfg.searchable ? (
            <input
              type="search"
              className={styles.searchInput}
              placeholder={`Search ${table.name}`}
              aria-label={`Search ${el.title || table.name}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : (
            <span />
          )}
          {cfg.permissions.allowCreate && ctx.canWrite ? (
            <button type="button" className={styles.secondaryBtn} onClick={() => setCreating(true)}>
              + New record
            </button>
          ) : null}
        </div>
      ) : null}

      {q.isError ? <Problem>{errorText(q.error)}</Problem> : null}
      {q.isLoading ? <div className={styles.muted}>Loading…</div> : null}
      {!q.isLoading && !q.isError && records.length === 0 ? (
        <div className={styles.emptyRecords}>{cfg.emptyText || (debounced ? "No matching records" : "No records")}</div>
      ) : null}

      {records.length > 0 && el.type === "table" ? (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                {fields.map(({ ef, field }) => (
                  <th key={field.id} scope="col">
                    {ef.label?.trim() || field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr
                  key={rec.id}
                  data-selected={selected === rec.id || undefined}
                  tabIndex={0}
                  onClick={() => activate(rec)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") activate(rec);
                  }}
                >
                  {fields.map(({ field }) => (
                    <td key={field.id}>
                      <CellValueDisplay field={field} value={rec.fields[field.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {records.length > 0 && el.type === "record_list" ? (
        <ul className={styles.recordList}>
          {records.map((rec) => (
            <li key={rec.id}>
              <button type="button" className={styles.recordListItem} data-selected={selected === rec.id || undefined} onClick={() => activate(rec)}>
                <span className={styles.recordListTitle}>{title(rec)}</span>
                <span className={styles.recordListMeta}>
                  {fields
                    .filter(({ field }) => field.id !== titleField?.id)
                    .slice(0, 3)
                    .map(({ field }) => (
                      <span key={field.id} className={styles.recordListCell}>
                        <CellValueDisplay field={field} value={rec.fields[field.id]} />
                      </span>
                    ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {records.length > 0 && el.type === "gallery" ? (
        <div className={styles.gallery}>
          {records.map((rec) => (
            <button key={rec.id} type="button" className={styles.galleryCard} data-selected={selected === rec.id || undefined} onClick={() => activate(rec)}>
              <span className={styles.galleryTitle}>{title(rec)}</span>
              {fields
                .filter(({ field }) => field.id !== titleField?.id)
                .map(({ ef, field }) => (
                  <span key={field.id} className={styles.galleryField}>
                    <span className={styles.galleryLabel}>{ef.label?.trim() || field.name}</span>
                    <span className={styles.galleryValue}>
                      <CellValueDisplay field={field} value={rec.fields[field.id]} />
                    </span>
                  </span>
                ))}
            </button>
          ))}
        </div>
      ) : null}

      {q.hasNextPage ? (
        <button type="button" className={styles.linkBtn} disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {q.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {open ? (
        <Dialog title={title(open)} onClose={() => setOpen(null)} wide>
          <RecordFields ctx={ctx} table={table} record={open} fields={cfg.fields} onSaved={(r) => setOpen(r)} />
        </Dialog>
      ) : null}
      {creating ? (
        <Dialog title={`New ${table.name}`} onClose={() => setCreating(false)} wide>
          <FormPreview
            baseId={ctx.baseId}
            table={table}
            form={{
              title: "",
              description: "",
              fields: fields.filter(({ field }) => isEditableField(field)).map(({ ef }) => ({ fieldId: ef.fieldId, required: Boolean(ef.required) })),
              submitLabel: "Create record",
              successMessage: "Record created.",
              allowResubmit: true,
            }}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Record details */

/** The element's fields for one record; editable ones save as you type. */
function RecordFields({
  ctx,
  table,
  record,
  fields,
  onSaved,
}: {
  ctx: RenderCtx;
  table: TableDto;
  record: ElementRecord;
  fields: ElementField[];
  onSaved?: (r: ElementRecord) => void;
}) {
  const qc = useQueryClient();
  const items = resolveFields(table, fields);
  const [values, setValues] = useState<Record<string, unknown>>(record.fields);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setValues(record.fields), [record]);

  const flush = async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      const saved = await viewRecordsApi.patch(ctx.baseId, table.id, record.id, patch);
      setError(null);
      onSaved?.({ id: record.id, fields: { ...record.fields, ...saved.fields } });
      void qc.invalidateQueries({ queryKey: ["records", ctx.baseId, table.id] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record.id],
  );

  return (
    <div className={styles.detail}>
      {items.length === 0 ? <div className={styles.muted}>No fields are shown here yet.</div> : null}
      {items.map(({ ef, field }) => {
        const editable = ef.editable && ctx.canWrite && !ctx.editing && isEditableField(field);
        const labelId = `itf-${record.id}-${field.id}`;
        return (
          <div key={field.id} className={styles.detailRow}>
            <div className={styles.detailLabel} id={labelId}>
              {ef.label?.trim() || field.name}
            </div>
            <div className={styles.detailValue}>
              {editable ? (
                <ValueEditor
                  baseId={ctx.baseId}
                  field={field}
                  labelledBy={labelId}
                  value={values[field.id]}
                  onChange={(v) => {
                    setValues((s) => ({ ...s, [field.id]: v }));
                    pending.current[field.id] = v;
                    if (timer.current) clearTimeout(timer.current);
                    timer.current = setTimeout(() => void flush(), 600);
                  }}
                />
              ) : (
                <CellValueDisplay field={field} value={values[field.id]} />
              )}
            </div>
          </div>
        );
      })}
      {error ? <div className={styles.elementProblem}>{error}</div> : null}
      {saving ? <div className={styles.muted}>Saving…</div> : null}
    </div>
  );
}

function RecordDetailElement({ el, ctx }: { el: Extract<InterfaceElement, { type: "record_detail" }>; ctx: RenderCtx }) {
  const srcId = el.config.dataSource.recordContext.elementId;
  const selected = ctx.selections[srcId];
  const table = tableOf(ctx, el.config.dataSource.tableId);
  const source = ctx.elements.find((e) => e.id === srcId);
  const q = useQuery({
    queryKey: ["records", ctx.baseId, el.config.dataSource.tableId, "itf", ctx.interfaceId, ctx.pageId, el.id, ctx.draft, ctx.token, selected],
    queryFn: () =>
      interfacesApi.queryElement(ctx.baseId, ctx.interfaceId, ctx.pageId, el.id, {
        draft: ctx.draft,
        context: { selections: selected ? { [srcId]: selected } : {} },
      }),
    enabled: Boolean(selected && table),
    staleTime: 15_000,
  });
  if (!table) return <Problem>This element's table was deleted.</Problem>;
  if (!source) return <Problem>The element this one follows was removed. Pick another in the settings.</Problem>;
  if (!selected) return <div className={styles.emptyRecords}>Select a record in “{source.title || "the list"}” to see its details.</div>;
  if (q.isLoading) return <div className={styles.muted}>Loading…</div>;
  if (q.isError) return <Problem>{errorText(q.error)}</Problem>;
  const rec = q.data?.records[0];
  if (!rec) return <div className={styles.emptyRecords}>That record is no longer available.</div>;
  return <RecordFields ctx={ctx} table={table} record={rec} fields={el.config.fields} />;
}

/* ------------------------------------------------------------------ */
/* Form + button */

function FormElement({ el, ctx }: { el: Extract<InterfaceElement, { type: "form" }>; ctx: RenderCtx }) {
  const table = tableOf(ctx, el.config.tableId);
  const form = useMemo(
    () => ({
      title: el.title ?? "",
      description: el.description ?? "",
      fields: el.config.fields.map((f) => ({ fieldId: f.fieldId, required: Boolean(f.required), ...(f.label ? { label: f.label } : {}) })),
      submitLabel: el.config.submit.label,
      successMessage: el.config.submit.message,
      allowResubmit: true,
    }),
    [el],
  );
  if (!table) return <Problem>This form's table was deleted.</Problem>;
  if (!ctx.canWrite) return <Problem>You don't have permission to add records to {table.name}.</Problem>;
  return (
    <div className={styles.formWrap}>
      <FormPreview baseId={ctx.baseId} table={table} form={form} interactive={!ctx.editing} />
    </div>
  );
}

function ButtonElement({ el, ctx }: { el: Extract<InterfaceElement, { type: "button" }>; ctx: RenderCtx }) {
  const run = () => {
    if (ctx.editing) return;
    for (const a of el.config.actions) {
      if (a.kind === "open_url") {
        if (/^(https:|mailto:|tel:)/i.test(a.urlTemplate)) window.open(a.urlTemplate, a.newTab ? "_blank" : "_self", "noopener,noreferrer");
      } else if (ctx.pages.some((p) => p.id === a.pageId)) {
        ctx.navigate(a.pageId);
      }
    }
  };
  const cls =
    el.config.style === "secondary"
      ? styles.secondaryBtn
      : el.config.style === "danger"
        ? styles.dangerBtn
        : el.config.style === "link"
          ? styles.linkBtn
          : styles.primaryBtn;
  return (
    <button type="button" className={cls} onClick={run} title={ctx.editing ? "Buttons run in Preview" : undefined}>
      {el.config.label}
    </button>
  );
}
