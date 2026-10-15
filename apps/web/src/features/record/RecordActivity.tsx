import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldTypeIcon, renderCellValue, type FieldLike } from "@tabula/field-ui";
import { DropdownMenu, type MenuItemSpec } from "../../app/ui.tsx";
import { commentsApi, relativeTime, type NotifyLevel } from "../../lib/api-areas/collab.ts";
import {
  errorMessage,
  recordsApi,
  type HistoryChangeWire,
  type HistoryEntryWire,
  type HistoryFieldWire,
} from "../../lib/api-areas/records.ts";
import { RecordComments, type CommentFilter, type TimelineItem } from "../comments/RecordComments.tsx";
import styles from "./record-activity.module.css";

/** Airtable's record activity menu. */
export type ActivityFilter = "all" | "history" | "comments" | "record_comments" | "attachment_comments" | "with_attachments";

/** How revision history is grouped (many people editing the same table). */
export type HistoryGrouping = "none" | "person" | "field";
const GROUP_KEY = "tabula.recordActivityGroup";
const GROUP_LABELS: Record<HistoryGrouping, string> = { none: "Don’t group", person: "By person", field: "By field" };
const FILTER_KEY = "tabula.recordActivityFilter";
const RESOLVED_KEY = "tabula.recordActivityResolved";
const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "All activity",
  history: "Revision history",
  comments: "All comments",
  record_comments: "Record comments",
  attachment_comments: "Comments on attachments",
  with_attachments: "Comments with attachments",
};
const COMMENTS_FOR: Record<ActivityFilter, CommentFilter> = {
  all: "all",
  history: "none",
  comments: "all",
  record_comments: "record",
  attachment_comments: "on_attachments",
  with_attachments: "with_attachments",
};
const NOTIFY_LABELS: Record<NotifyLevel, string> = {
  all: "All comments",
  mentions: "Only @mentions and replies",
  off: "Off",
};

function readFilter(): ActivityFilter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return v && v in FILTER_LABELS ? (v as ActivityFilter) : "all";
  } catch {
    return "all";
  }
}

function readGrouping(): HistoryGrouping {
  try {
    const v = localStorage.getItem(GROUP_KEY);
    return v === "person" || v === "field" ? v : "none";
  } catch {
    return "none";
  }
}

function readResolved(): boolean {
  try {
    return localStorage.getItem(RESOLVED_KEY) === "1";
  } catch {
    return false;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export const historyQueryKey = (baseId: string, tableId: string, recordId: string) =>
  ["record", baseId, tableId, recordId, "history"] as const;

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function Time({ iso }: { iso: string }) {
  return (
    <time className={styles.time} dateTime={iso} title={new Date(iso).toLocaleString()}>
      {relativeTime(iso)}
    </time>
  );
}

function actorLabel(e: HistoryEntryWire): string {
  switch (e.source) {
    case "automation":
      return e.sourceName ? `Automation “${e.sourceName}”` : "An automation";
    case "form":
      return "Form submission";
    case "system":
      return e.actor?.name ?? "TableOS";
    default:
      return e.actor?.name ?? "Someone";
  }
}

function verb(e: HistoryEntryWire): string {
  if (e.kind === "created") {
    if (e.source === "form") return "created this record";
    if (e.source === "import") return "imported this record";
    return e.duplicatedFrom ? "created this record by duplicating" : "created this record";
  }
  if (e.kind === "deleted") return "deleted this record";
  if (e.kind === "restored") return e.source === "restore" ? "restored this record from trash" : "restored this record";
  if (!e.detailed && e.changes.length === 0) return e.source === "redo" ? "redid a change" : "reverted a change";
  const n = e.changes.length;
  return n === 1 ? "edited a field" : `edited ${n} fields`;
}

const SOURCE_TAG: Partial<Record<HistoryEntryWire["source"], string>> = {
  automation: "Automation",
  form: "Form",
  import: "Import",
  undo: "Undo",
  redo: "Redo",
  restore: "Trash",
};

function Value({ field, value }: { field: FieldLike; value: unknown }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return <span className={styles.empty}>(empty)</span>;
  }
  return <>{renderCellValue(field, value, { wrap: true })}</>;
}

function ChangeRow({ change, field, meta }: { change: HistoryChangeWire; field: FieldLike | undefined; meta: HistoryFieldWire | undefined }) {
  const f: FieldLike = field ?? {
    id: change.fieldId,
    name: meta?.name ?? "Unknown field",
    type: meta?.type ?? "text",
    config: meta?.config ?? {},
  };
  const deleted = !field;
  return (
    <div className={styles.change} data-testid="history-change" data-field={change.fieldId}>
      <div className={styles.changeField}>
        <span className={styles.fieldIcon}>{fieldTypeIcon(f.type)}</span>
        <span className={deleted ? styles.deletedField : undefined}>{f.name}</span>
        {deleted ? <span className={styles.deletedTag}>deleted field</span> : null}
      </div>
      {"added" in change ? (
        <div className={styles.links}>
          {change.added.map((l) => (
            <span key={`a${l.id}`} className={styles.added} title="Linked">
              + {l.name || "Unnamed record"}
            </span>
          ))}
          {change.removed.map((l) => (
            <span key={`r${l.id}`} className={styles.removed} title="Unlinked">
              − {l.name || "Unnamed record"}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.diff}>
          <div className={styles.before} aria-label="Previous value">
            <Value field={f} value={change.before} />
          </div>
          <span className={styles.arrow} aria-hidden>
            →
          </span>
          <div className={styles.after} aria-label="New value">
            <Value field={f} value={change.after} />
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryItem({ entry, fields, metas }: { entry: HistoryEntryWire; fields: Map<string, FieldLike>; metas: Record<string, HistoryFieldWire> }) {
  const who = actorLabel(entry);
  const tag = SOURCE_TAG[entry.source];
  return (
    <li className={styles.item} data-testid="history-entry" data-kind={entry.kind}>
      <span className={`${styles.avatar} ${entry.source === "automation" || entry.source === "form" ? styles.avatarBot : ""}`} aria-hidden>
        {entry.source === "automation" ? "⚡" : entry.source === "form" ? "✉" : initials(who)}
      </span>
      <div className={styles.main}>
        <div className={styles.line}>
          <span className={styles.who}>{who}</span> <span className={styles.verb}>{verb(entry)}</span>
          {entry.kind === "created" && entry.duplicatedFrom ? (
            <span className={styles.who}> {entry.duplicatedFrom.name || "a record"}</span>
          ) : null}
          {tag ? <span className={styles.tag}>{tag}</span> : null}
        </div>
        <Time iso={entry.at} />
        {entry.changes.map((c) => (
          <ChangeRow key={c.fieldId} change={c} field={fields.get(c.fieldId)} meta={metas[c.fieldId]} />
        ))}
      </div>
    </li>
  );
}

interface HistoryGroup {
  key: string;
  title: string;
  icon: string;
  entries: HistoryEntryWire[];
  latest: number;
  people: number;
}

/** Revision history entries grouped by who made them, or by the field they changed. */
function groupHistory(entries: HistoryEntryWire[], by: Exclude<HistoryGrouping, "none">, metas: Record<string, HistoryFieldWire>, fields: Map<string, FieldLike>): HistoryGroup[] {
  const groups = new Map<string, HistoryGroup>();
  const add = (key: string, title: string, icon: string, entry: HistoryEntryWire) => {
    const g = groups.get(key) ?? { key, title, icon, entries: [], latest: 0, people: 0 };
    g.entries.push(entry);
    g.latest = Math.max(g.latest, Date.parse(entry.at));
    groups.set(key, g);
  };
  for (const e of entries) {
    if (by === "person") {
      const who = actorLabel(e);
      add(`p:${e.actor?.id ?? e.source}:${who}`, who, e.source === "automation" ? "⚡" : e.source === "form" ? "✉" : initials(who), e);
      continue;
    }
    if (e.changes.length === 0) {
      add(`k:${e.kind}`, e.kind === "created" ? "Record created" : e.kind === "deleted" ? "Record deleted" : e.kind === "restored" ? "Record restored" : "Other changes", "•", e);
      continue;
    }
    for (const c of e.changes) {
      const f = fields.get(c.fieldId);
      const name = f?.name ?? metas[c.fieldId]?.name ?? "Deleted field";
      add(`f:${c.fieldId}`, name, fieldTypeIcon(f?.type ?? metas[c.fieldId]?.type ?? "text"), { ...e, changes: [c] });
    }
  }
  for (const g of groups.values()) g.people = new Set(g.entries.map((e) => actorLabel(e))).size;
  return [...groups.values()].sort((a, b) => b.latest - a.latest);
}

function HistoryGroupItem({ group, by, fields, metas, open }: { group: HistoryGroup; by: Exclude<HistoryGrouping, "none">; fields: Map<string, FieldLike>; metas: Record<string, HistoryFieldWire>; open: boolean }) {
  const n = group.entries.length;
  return (
    <li className={styles.group} data-testid="history-group" data-group={group.key}>
      <details open={open}>
        <summary className={styles.groupHead}>
          <span className={by === "person" ? styles.avatar : styles.groupIcon} aria-hidden>
            {group.icon}
          </span>
          <span className={styles.groupTitle}>{group.title}</span>
          <span className={styles.groupMeta}>
            {n} change{n === 1 ? "" : "s"}
            {by === "field" ? ` · ${group.people} ${group.people === 1 ? "person" : "people"}` : ""} · latest {relativeTime(new Date(group.latest).toISOString())}
          </span>
        </summary>
        <ul className={styles.groupList}>
          {group.entries.map((e, i) => (
            <HistoryItem key={`${e.id}:${i}`} entry={e} fields={fields} metas={metas} />
          ))}
        </ul>
      </details>
    </li>
  );
}

/** Bell: which comments on this record notify me. */
function NotifyMenu({ baseId, tableId, recordId }: { baseId: string; tableId: string; recordId: string }) {
  const qc = useQueryClient();
  const key = ["record-subscription", baseId, tableId, recordId];
  const sub = useQuery({ queryKey: key, queryFn: () => commentsApi.subscription(baseId, tableId, recordId), staleTime: 30_000 });
  const set = useMutation({
    mutationFn: (level: NotifyLevel) => commentsApi.setSubscription(baseId, tableId, recordId, level),
    onMutate: (level) => qc.setQueryData(key, { level }),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
  const level = sub.data?.level ?? "mentions";
  const items: MenuItemSpec[] = [
    { key: "h", heading: true, label: "Notify me about" },
    ...(Object.keys(NOTIFY_LABELS) as NotifyLevel[]).map((l) => ({
      key: l,
      label: NOTIFY_LABELS[l],
      hint: l === level ? "✓" : undefined,
      onSelect: () => set.mutate(l),
    })),
  ];
  return (
    <DropdownMenu
      align="right"
      items={items}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className={open ? styles.headBtnOn : styles.headBtn}
          onClick={toggle}
          aria-label={`Notifications for this record: ${NOTIFY_LABELS[level]}`}
          title={`Notifications: ${NOTIFY_LABELS[level]}`}
        >
          <span aria-hidden className={level === "off" ? styles.bellOff : undefined}>
            🔔
          </span>
          <span aria-hidden className={styles.chevron}>
            ⌄
          </span>
        </button>
      )}
    />
  );
}

export interface RecordActivityProps {
  baseId: string;
  tableId: string;
  recordId: string;
  /** Current record version; a change refetches the history (own edits skip realtime). */
  recordVersion?: number | undefined;
  /** Live fields of the table (current names/config win over the history's snapshot). */
  fields: FieldLike[];
  canComment?: boolean;
}

/** Drawer side panel: comments and revision history, with Airtable's activity menu and notification bell. */
export function RecordActivity({ baseId, tableId, recordId, recordVersion, fields, canComment = true }: RecordActivityProps) {
  const qc = useQueryClient();
  const [filter, setFilterState] = useState<ActivityFilter>(readFilter);
  const [showResolved, setShowResolvedState] = useState(readResolved);
  const [grouping, setGroupingState] = useState<HistoryGrouping>(readGrouping);
  const setGrouping = (g: HistoryGrouping) => {
    setGroupingState(g);
    store(GROUP_KEY, g);
  };
  const setFilter = (f: ActivityFilter) => {
    setFilterState(f);
    store(FILTER_KEY, f);
  };
  const setShowResolved = (v: boolean) => {
    setShowResolvedState(v);
    store(RESOLVED_KEY, v ? "1" : "0");
  };
  const showHistory = filter === "all" || filter === "history";
  const key = historyQueryKey(baseId, tableId, recordId);
  const history = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => recordsApi.history(baseId, tableId, recordId, { cursor: pageParam, limit: 30 }, signal),
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
    enabled: showHistory,
  });

  const lastVersion = useRef(recordVersion);
  useEffect(() => {
    if (recordVersion === undefined || recordVersion === lastVersion.current) return;
    lastVersion.current = recordVersion;
    const t = setTimeout(() => void qc.invalidateQueries({ queryKey: key }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordVersion, qc, baseId, tableId, recordId]);

  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
  const pages = history.data?.pages ?? [];
  const metas = useMemo(() => Object.assign({}, ...pages.map((p) => p?.fields ?? {})) as Record<string, HistoryFieldWire>, [pages]);
  const entries = useMemo(() => pages.flatMap((p) => p?.entries ?? []), [pages]);
  const retentionDays = pages[0]?.retentionDays ?? null;

  const timeline: TimelineItem[] = useMemo(() => {
    if (!showHistory) return [];
    if (grouping === "none") {
      return entries.map((e) => ({ at: Date.parse(e.at), key: `h${e.id}`, node: <HistoryItem key={`h${e.id}`} entry={e} fields={fieldMap} metas={metas} /> }));
    }
    const groups = groupHistory(entries, grouping, metas, fieldMap);
    return groups.map((g) => ({
      at: g.latest,
      key: `g${g.key}`,
      node: <HistoryGroupItem key={`g${g.key}`} group={g} by={grouping} fields={fieldMap} metas={metas} open={groups.length === 1} />,
    }));
  }, [showHistory, entries, fieldMap, metas, grouping]);
  const oldestLoaded = filter === "all" && history.hasNextPage && entries.length ? Date.parse(entries[entries.length - 1]!.at) : -Infinity;

  const menu: MenuItemSpec[] = [
    ...(["all", "history"] as ActivityFilter[]).map((f) => ({ key: f, label: FILTER_LABELS[f], hint: filter === f ? "✓" : undefined, onSelect: () => setFilter(f) })),
    ...(["comments", "record_comments", "attachment_comments", "with_attachments"] as ActivityFilter[]).map((f, i) => ({
      key: f,
      label: FILTER_LABELS[f],
      hint: filter === f ? "✓" : undefined,
      separatorBefore: i === 0,
      onSelect: () => setFilter(f),
    })),
    {
      key: "resolved",
      label: "Show resolved comments",
      hint: showResolved ? "✓" : undefined,
      separatorBefore: true,
      disabled: filter === "history",
      onSelect: () => setShowResolved(!showResolved),
    },
    { key: "group-h", heading: true, label: "Group revision history", separatorBefore: true },
    ...(Object.keys(GROUP_LABELS) as HistoryGrouping[]).map((g) => ({
      key: `group-${g}`,
      label: GROUP_LABELS[g],
      hint: grouping === g ? "✓" : undefined,
      disabled: !showHistory,
      onSelect: () => setGrouping(g),
    })),
  ];

  return (
    <section className={styles.panel} aria-label="Record activity">
      <div className={styles.head}>
        <DropdownMenu
          items={menu}
          trigger={({ toggle, open }) => (
            <button type="button" className={open ? styles.filterBtnOn : styles.filterBtn} onClick={toggle} aria-haspopup="menu" aria-label="Show activity">
              {FILTER_LABELS[filter]}
              {showHistory && grouping !== "none" ? ` · ${GROUP_LABELS[grouping].toLowerCase()}` : ""}
              <span aria-hidden className={styles.chevron}>
                ⌄
              </span>
            </button>
          )}
        />
        <NotifyMenu baseId={baseId} tableId={tableId} recordId={recordId} />
      </div>
      {history.isError && showHistory ? <p className={styles.error}>Couldn't load history: {errorMessage(history.error)}</p> : null}
      <RecordComments
        baseId={baseId}
        tableId={tableId}
        recordId={recordId}
        filter={COMMENTS_FOR[filter]}
        showResolved={showResolved}
        canComment={canComment}
        timeline={timeline}
        hideCommentsBefore={oldestLoaded}
        loadingTimeline={showHistory && history.isLoading}
        top={
          showHistory && history.hasNextPage ? (
            <button type="button" className={styles.more} disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
              {history.isFetchingNextPage ? "Loading…" : "Show older activity"}
            </button>
          ) : null
        }
        footer={
          showHistory && !history.hasNextPage && retentionDays && entries.length > 0 ? (
            <p className={styles.note}>Revision history is kept for {retentionDays} days on your plan.</p>
          ) : null
        }
      />
    </section>
  );
}
