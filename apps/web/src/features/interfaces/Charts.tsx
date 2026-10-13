import { cellValueToText } from "@tabula/field-ui";
import { useState } from "react";
import type { FieldDto } from "../../lib/api.ts";
import type { ChartConfig, ChartPoint, DateBucket, DateRange, InterfaceElement, Measure } from "../../lib/api-areas/interfaces.ts";
import { errorText, presetRange, Problem, rangesFor, tableOf, useAggregate, type RenderCtx } from "./Elements.tsx";
import styles from "./interfaces.module.css";

export const CHART_COLORS = ["#166ee1", "#f7a300", "#1aa365", "#e2405f", "#8e4fc9", "#2bb7c6", "#c96b1a", "#5a6576"];
const OTHER_COLOR = "#a0a7b4";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AGG_LABEL: Record<Measure["agg"], string> = {
  count: "Records",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  count_unique: "Unique",
};
export const BUCKET_LABEL: Record<DateBucket, string> = { day: "Day", week: "Week", month: "Month", quarter: "Quarter", year: "Year" };

interface Series {
  name: string;
  color: string;
  values: number[];
}

interface ChartData {
  labels: string[];
  series: Series[];
  note?: string;
}

/* ---------------- formatting ---------------- */

const valueFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export function fmtValue(n: number): string {
  return Math.abs(n) >= 100_000 ? compactFmt.format(n) : valueFmt.format(n);
}

function fmtTick(n: number): string {
  return Math.abs(n) >= 1000 ? compactFmt.format(n) : valueFmt.format(n);
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** "Nice" axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/* ---------------- date buckets ---------------- */

function parseDay(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

export function nextBucket(day: string, bucket: DateBucket): string {
  const d = parseDay(day)!;
  if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
  else if (bucket === "week") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + (bucket === "month" ? 1 : bucket === "quarter" ? 3 : 12));
  return d.toISOString().slice(0, 10);
}

/** First day of the bucket containing `day` (weeks start on Monday, like Postgres `date_trunc`). */
export function bucketStart(day: string, bucket: DateBucket): string {
  const d = parseDay(day);
  if (!d) return day;
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  else if (bucket === "month") d.setUTCDate(1);
  else if (bucket === "quarter") d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3, 1);
  else if (bucket === "year") d.setUTCMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

export function bucketLabel(day: string, bucket: DateBucket, withYear: boolean): string {
  const d = parseDay(day);
  if (!d) return day;
  const y = d.getUTCFullYear();
  const mon = MONTHS[d.getUTCMonth()]!;
  const yy = withYear ? ` ’${String(y).slice(2)}` : "";
  switch (bucket) {
    case "day":
      return `${mon} ${d.getUTCDate()}${yy}`;
    case "week":
      return `Wk ${mon} ${d.getUTCDate()}${yy}`;
    case "month":
      return `${mon} ${y}`;
    case "quarter":
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${y}`;
    case "year":
      return String(y);
  }
}

/* ---------------- data shaping ---------------- */

function pointLabel(field: FieldDto | undefined, p: ChartPoint): string {
  if (p.label === null || p.label === undefined || p.label === "") return "(Empty)";
  if (!field) return String(p.label);
  return cellValueToText(field, p.label) || String(p.label);
}

export function measureLabel(m: Measure, fields: FieldDto[]): string {
  if (m.label) return m.label;
  if (m.agg === "count") return "Records";
  const f = fields.find((x) => x.id === m.fieldId);
  return `${AGG_LABEL[m.agg]} of ${f?.name ?? "field"}`;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

export function buildChartData(
  cfg: ChartConfig,
  points: ChartPoint[],
  xField: FieldDto | undefined,
  fields: FieldDto[],
  range?: DateRange,
): ChartData {
  const names = cfg.measures.map((m) => measureLabel(m, fields));
  const color = (i: number) => CHART_COLORS[i % CHART_COLORS.length]!;
  const bucket = cfg.x.bucket;
  if (!bucket) {
    return {
      labels: points.map((p) => pointLabel(xField, p)),
      series: names.map((name, i) => ({ name, color: color(i), values: points.map((p) => num(p.values[i])) })),
    };
  }
  const dated = points.filter((p) => parseDay(p.label));
  const undated = points.filter((p) => !parseDay(p.label)).reduce((s, p) => s + p.count, 0);
  const byKey = new Map(dated.map((p) => [String(p.label).slice(0, 10), p]));
  let keys = dated.map((p) => String(p.label).slice(0, 10));
  if (cfg.x.sort === "label" && (keys.length > 0 || (range?.from && range.to))) {
    // Chronological charts show empty periods as zero, across the whole chosen range.
    const sorted = [...keys].sort();
    const first = range?.from ? bucketStart(range.from, bucket) : sorted[0]!;
    const last = range?.to ? bucketStart(range.to, bucket) : sorted[sorted.length - 1]!;
    const filled: string[] = [];
    for (let k = first; k <= last && filled.length < cfg.x.limit; k = nextBucket(k, bucket)) filled.push(k);
    if (filled.length) keys = filled;
  }
  const years = new Set(keys.map((k) => k.slice(0, 4)));
  return {
    labels: keys.map((k) => bucketLabel(k, bucket, years.size > 1)),
    series: names.map((name, i) => ({ name, color: color(i), values: keys.map((k) => num(byKey.get(k)?.values[i])) })),
    ...(undated ? { note: `${undated.toLocaleString()} record${undated === 1 ? "" : "s"} without ${xField?.name ?? "a date"} not shown` } : {}),
  };
}

/* ---------------- element ---------------- */

export function ChartElement({ el, ctx }: { el: Extract<InterfaceElement, { type: "chart" }>; ctx: RenderCtx }) {
  const q = useAggregate(el, ctx, el.config.source.tableId);
  const table = tableOf(ctx, el.config.source.tableId);
  const xField = table?.fields.find((f) => f.id === el.config.x.fieldId);
  if (!table) return <Problem>This chart's table was deleted.</Problem>;
  if (!xField) return <Problem>Pick a field to group the chart by.</Problem>;
  if (q.isLoading) return <div className={styles.chartEmpty}>Loading…</div>;
  if (q.isError) return <Problem>{errorText(q.error)}</Problem>;
  const ranges = rangesFor(ctx, el.config.source.tableId);
  const range = ranges ? intersect(Object.values(ranges)) : undefined;
  const data = buildChartData(el.config, q.data?.points ?? [], xField, table.fields, el.config.x.fieldId === rangeFieldOf(ctx, el.config.source.tableId) ? range : undefined);
  if (data.labels.length === 0 || (ranges && (q.data?.points ?? []).length === 0)) {
    return <div className={styles.chartEmpty}>{ranges ? "No records in this date range" : "No data to chart"}</div>;
  }
  const kind = el.config.kind;
  const showValues = el.config.options?.showValues ?? false;
  const showLegend = el.config.options?.showLegend ?? data.series.length > 1;
  const bucket = el.config.x.bucket;
  return (
    <div className={styles.chart}>
      {showLegend && kind !== "pie" && kind !== "donut" ? <SeriesLegend series={data.series} /> : null}
      {kind === "pie" || kind === "donut" ? (
        <PieChart data={data} donut={kind === "donut"} />
      ) : kind === "hbar" ? (
        <HBarChart data={data} showValues={showValues} />
      ) : (
        <XYChart data={data} kind={kind} showValues={showValues} />
      )}
      {q.data?.truncated ? (
        <div className={styles.muted}>
          {bucket && el.config.x.sort === "label"
            ? `Showing the latest ${el.config.x.limit} ${BUCKET_LABEL[bucket].toLowerCase()}s`
            : `Showing the first ${el.config.x.limit} groups`}
        </div>
      ) : null}
      {data.note ? <div className={styles.muted}>{data.note}</div> : null}
    </div>
  );
}

/** The narrowest range covered by every active date filter. */
function intersect(ranges: DateRange[]): DateRange {
  let from: string | null = null;
  let to: string | null = null;
  for (const r of ranges) {
    if (r.from && (!from || r.from > from)) from = r.from;
    if (r.to && (!to || r.to < to)) to = r.to;
  }
  const today = presetRange("today").to!;
  return { from, to: to && to > today ? today : to };
}

/** Field the page's date filter narrows on this table, so only charts over that field stretch to the range. */
function rangeFieldOf(ctx: RenderCtx, tableId: string): string | undefined {
  const df = ctx.elements.find((e) => e.type === "date_filter" && e.config.tableId === tableId);
  return df?.type === "date_filter" ? df.config.fieldId : undefined;
}

function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <ul className={styles.seriesLegend}>
      {series.map((s) => (
        <li key={s.name}>
          <span className={styles.legendSwatch} style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ title, series, index, left }: { title: string; series: Series[]; index: number; left: number }) {
  return (
    <div className={styles.chartTip} style={{ left: `${Math.min(85, Math.max(15, left))}%` }}>
      <div className={styles.chartTipTitle}>{title}</div>
      {series.map((s) => (
        <div key={s.name} className={styles.chartTipRow}>
          <span className={styles.legendSwatch} style={{ background: s.color }} />
          <span className={styles.legendLabel}>{s.name}</span>
          <span className={styles.legendValue}>{fmtValue(s.values[index] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- vertical bar / line / area ---------------- */

function XYChart({ data, kind, showValues }: { data: ChartData; kind: "bar" | "line" | "area"; showValues: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 260;
  const pad = { l: 52, r: 14, t: 18, b: 40 };
  const { labels, series } = data;
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const y0 = ticks[0]!;
  const y1 = ticks[ticks.length - 1]!;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const yOf = (v: number) => pad.t + plotH * (1 - (v - y0) / (y1 - y0));
  const n = labels.length;
  const slot = plotW / n;
  const cx = (i: number) => pad.l + slot * (i + 0.5);
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 72))));
  const S = series.length;
  const bw = Math.max(2, Math.min(36, (slot * 0.78) / S));
  const barX = (i: number, j: number) => cx(i) - (bw * S) / 2 + j * bw;
  const zero = yOf(0);
  const valuesFit = showValues && n * (kind === "bar" ? S : 1) <= 36;
  return (
    <div className={styles.chartWrap} onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chartSvg}
        role="img"
        aria-label={labels.map((l, i) => `${l}: ${series.map((s) => fmtValue(s.values[i] ?? 0)).join(" / ")}`).join(", ")}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? styles.chartZero : styles.chartGrid} />
            <text x={pad.l - 6} y={yOf(t) + 4} textAnchor="end" className={styles.chartTick}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {hover !== null ? <rect x={pad.l + slot * hover} y={pad.t} width={slot} height={plotH} className={styles.chartHover} /> : null}
        {kind === "bar"
          ? series.map((s, j) =>
              s.values.map((v, i) => (
                <rect
                  key={`${j}-${i}`}
                  x={barX(i, j) + 0.5}
                  y={Math.min(yOf(v), zero)}
                  width={Math.max(1, bw - 1)}
                  height={Math.abs(yOf(v) - zero)}
                  rx={2}
                  fill={s.color}
                />
              )),
            )
          : series.map((s, j) => {
              const pts = s.values.map((v, i) => `${cx(i)},${yOf(v)}`);
              return (
                <g key={j}>
                  {kind === "area" ? <path d={`M ${cx(0)},${zero} L ${pts.join(" L ")} L ${cx(n - 1)},${zero} Z`} fill={s.color} fillOpacity={0.16} /> : null}
                  <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={pts.join(" ")} />
                  {n <= 45 || hover !== null
                    ? s.values.map((v, i) => (n <= 45 || hover === i ? <circle key={i} cx={cx(i)} cy={yOf(v)} r={hover === i ? 4.5 : 3} fill={s.color} /> : null))
                    : null}
                </g>
              );
            })}
        {valuesFit
          ? series.map((s, j) =>
              s.values.map((v, i) => (
                <text
                  key={`v${j}-${i}`}
                  x={kind === "bar" ? barX(i, j) + bw / 2 : cx(i)}
                  y={v >= 0 ? yOf(v) - 5 : yOf(v) + 12}
                  textAnchor="middle"
                  className={styles.chartValue}
                >
                  {fmtTick(v)}
                </text>
              )),
            )
          : null}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={`l${i}`} x={cx(i)} y={H - pad.b + 16} textAnchor="middle" className={styles.chartTick}>
              {clip(l, Math.max(4, Math.floor((slot * every) / 6)))}
            </text>
          ) : null,
        )}
        {labels.map((l, i) => (
          <rect key={`h${i}`} x={pad.l + slot * i} y={pad.t} width={slot} height={plotH + 24} fill="transparent" onMouseEnter={() => setHover(i)}>
            <title>{l}</title>
          </rect>
        ))}
      </svg>
      {hover !== null ? <Tooltip title={labels[hover]!} series={series} index={hover} left={(cx(hover) / W) * 100} /> : null}
    </div>
  );
}

/* ---------------- horizontal bar ---------------- */

function HBarChart({ data, showValues }: { data: ChartData; showValues: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const { labels, series } = data;
  const S = series.length;
  const W = 640;
  const pad = { l: 150, r: 52, t: 8, b: 24 };
  const rowH = Math.max(24, S * 12 + 10);
  const H = pad.t + labels.length * rowH + pad.b;
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
  const x0 = ticks[0]!;
  const x1 = ticks[ticks.length - 1]!;
  const xOf = (v: number) => pad.l + (W - pad.l - pad.r) * ((v - x0) / (x1 - x0));
  const zero = xOf(0);
  const bh = Math.max(6, (rowH - 8) / S);
  return (
    <div className={styles.chartWrap} onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chartSvgTall}
        role="img"
        aria-label={labels.map((l, i) => `${l}: ${fmtValue(series[0]!.values[i] ?? 0)}`).join(", ")}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xOf(t)} x2={xOf(t)} y1={pad.t} y2={H - pad.b} className={t === 0 ? styles.chartZero : styles.chartGrid} />
            <text x={xOf(t)} y={H - pad.b + 14} textAnchor="middle" className={styles.chartTick}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          const top = pad.t + i * rowH;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={0} y={top} width={W} height={rowH} className={hover === i ? styles.chartHover : undefined} fill="transparent" />
              <text x={pad.l - 8} y={top + rowH / 2 + 4} textAnchor="end" className={styles.chartLabel}>
                <title>{l}</title>
                {clip(l, 22)}
              </text>
              {series.map((s, j) => {
                const v = s.values[i] ?? 0;
                const y = top + 4 + j * bh;
                return (
                  <g key={j}>
                    <rect x={Math.min(xOf(v), zero)} y={y} width={Math.abs(xOf(v) - zero)} height={bh - 1} rx={2} fill={s.color} />
                    {showValues ? (
                      <text
                        x={v >= 0 ? xOf(v) + 4 : xOf(v) - 4}
                        y={y + bh / 2 + 3}
                        textAnchor={v >= 0 ? "start" : "end"}
                        className={styles.chartValue}
                      >
                        {fmtTick(v)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover !== null ? <Tooltip title={labels[hover]!} series={series} index={hover} left={50} /> : null}
    </div>
  );
}

/* ---------------- pie / donut ---------------- */

function PieChart({ data, donut }: { data: ChartData; donut: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const s = data.series[0]!;
  const negative = s.values.some((v) => v < 0);
  let slices = data.labels
    .map((label, i) => ({ label, value: Math.abs(s.values[i] ?? 0), color: CHART_COLORS[i % CHART_COLORS.length]! }))
    .filter((x) => x.value > 0);
  if (slices.length > 9) {
    const sorted = [...slices].sort((a, b) => b.value - a.value);
    const rest = sorted.slice(8).reduce((t, x) => t + x.value, 0);
    slices = [...sorted.slice(0, 8), { label: `Other (${sorted.length - 8})`, value: rest, color: OTHER_COLOR }];
  }
  const total = slices.reduce((t, x) => t + x.value, 0);
  if (!total) return <div className={styles.chartEmpty}>No data to chart</div>;
  const R = 80;
  const r = donut ? 50 : 0;
  const pt = (a: number, rad: number) => `${100 + rad * Math.cos(a)},${100 + rad * Math.sin(a)}`;
  const pct = (v: number) => `${Math.round((v / total) * 1000) / 10}%`;
  const focus = hover !== null ? slices[hover] : undefined;
  let a0 = -Math.PI / 2;
  const paths = slices.map((x) => {
    const frac = x.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const seg = { a0, a1, large: frac > 0.5 ? 1 : 0, full: frac >= 0.9999 };
    a0 = a1;
    return seg;
  });
  return (
    <div className={styles.pie}>
      <svg
        viewBox="0 0 200 200"
        className={styles.pieSvg}
        role="img"
        aria-label={slices.map((x) => `${x.label}: ${fmtValue(x.value)} (${pct(x.value)})`).join(", ")}
        onMouseLeave={() => setHover(null)}
      >
        {slices.map((x, i) => {
          const g = paths[i]!;
          const R2 = hover === i ? R + 4 : R;
          const d = g.full
            ? `M ${pt(-Math.PI / 2, R2)} A ${R2} ${R2} 0 1 1 ${pt(-Math.PI / 2 - 0.0001, R2)} Z`
            : `M ${pt(g.a0, R2)} A ${R2} ${R2} 0 ${g.large} 1 ${pt(g.a1, R2)} L ${r ? pt(g.a1, r) : "100,100"} ${r ? `A ${r} ${r} 0 ${g.large} 0 ${pt(g.a0, r)}` : ""} Z`;
          return (
            <path key={i} d={d} fill={x.color} stroke="var(--tabula-color-bg)" strokeWidth={1} onMouseEnter={() => setHover(i)}>
              <title>{`${x.label}: ${fmtValue(x.value)} (${pct(x.value)})`}</title>
            </path>
          );
        })}
        {donut ? (
          <>
            <circle cx={100} cy={100} r={r} fill="var(--tabula-color-bg)" pointerEvents="none" />
            <text x={100} y={100} textAnchor="middle" className={styles.donutValue}>
              {fmtValue(focus ? focus.value : total)}
            </text>
            <text x={100} y={116} textAnchor="middle" className={styles.chartTick}>
              {clip(focus ? focus.label : "Total", 16)}
            </text>
          </>
        ) : null}
      </svg>
      <ul className={styles.legend}>
        {slices.map((x, i) => (
          <li key={i} className={hover === i ? styles.legendOn : undefined} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className={styles.legendSwatch} style={{ background: x.color }} />
            <span className={styles.legendLabel} title={x.label}>
              {x.label}
            </span>
            <span className={styles.legendValue}>
              {fmtValue(x.value)} · {pct(x.value)}
            </span>
          </li>
        ))}
        {negative ? <li className={styles.muted}>Negative values are shown by size</li> : null}
      </ul>
    </div>
  );
}
