import { useCallback, useEffect, useState } from "react";

/**
 * Base URLs carry what is on screen, Airtable-style:
 *   /bases/bas_…/tbl_…/viw_…/rec_…
 * Segments are recognised by prefix. Older `?table=`, `?view=` and `?record=`
 * links still work and are rewritten to the path form.
 */
export interface BaseLocation {
  baseId: string | null;
  tableId: string | null;
  viewId: string | null;
  recordId: string | null;
}

const LEGACY_PARAMS = ["table", "view", "record"] as const;

export function readBaseLocation(href: string = window.location.href): BaseLocation {
  const url = new URL(href, window.location.origin);
  const parts = url.pathname.split("/").filter(Boolean);
  const out: BaseLocation = { baseId: null, tableId: null, viewId: null, recordId: null };
  if (parts[0] !== "bases") return out;
  out.baseId = parts[1] ?? null;
  for (const p of parts.slice(2)) {
    if (p.startsWith("tbl_")) out.tableId = p;
    else if (p.startsWith("viw_")) out.viewId = p;
    else if (p.startsWith("rec_")) out.recordId = p;
  }
  const q = url.searchParams;
  out.tableId ??= q.get("table");
  out.viewId ??= q.get("view");
  out.recordId ??= q.get("record");
  return out;
}

/** Path for a location; a record needs its table, a view needs its table. */
export function baseLocationPath(loc: BaseLocation): string {
  let path = `/bases/${loc.baseId}`;
  if (loc.tableId) {
    path += `/${loc.tableId}`;
    if (loc.viewId) path += `/${loc.viewId}`;
    if (loc.recordId) path += `/${loc.recordId}`;
  }
  return path;
}

/** Absolute URL of a record (for "Copy record URL"). */
export function recordHref(baseId: string, tableId: string, recordId: string, viewId?: string | null): string {
  return `${window.location.origin}${baseLocationPath({ baseId, tableId, viewId: viewId ?? null, recordId })}`;
}

/**
 * Update the current base URL. Changing the table or view drops the record
 * unless one is given. Other query parameters are kept.
 */
export function writeBaseLocation(patch: Partial<BaseLocation>, mode: "push" | "replace" = "replace"): void {
  const cur = readBaseLocation();
  if (!cur.baseId) return;
  const next: BaseLocation = { ...cur, ...patch };
  const tableChanged = "tableId" in patch && patch.tableId !== cur.tableId;
  const viewChanged = "viewId" in patch && Boolean(cur.viewId) && patch.viewId !== cur.viewId;
  if (tableChanged || viewChanged) {
    if (!("recordId" in patch)) next.recordId = null;
  }
  const url = new URL(window.location.href);
  for (const k of LEGACY_PARAMS) url.searchParams.delete(k);
  const q = url.searchParams.toString();
  const href = `${baseLocationPath(next)}${q ? `?${q}` : ""}${url.hash}`;
  if (href === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history[mode === "push" ? "pushState" : "replaceState"](window.history.state, "", href);
  window.dispatchEvent(new Event(BASE_LOCATION_EVENT));
}

/** Fired after `writeBaseLocation` (popstate covers back/forward). */
export const BASE_LOCATION_EVENT = "tableos:base-location";

/** The open record from the URL, and a setter that pushes when opening and replaces otherwise. */
export function useRecordParam(): [string | null, (id: string | null) => void] {
  const [recordId, setState] = useState<string | null>(() => readBaseLocation().recordId);
  useEffect(() => {
    const sync = () => setState(readBaseLocation().recordId);
    window.addEventListener("popstate", sync);
    window.addEventListener(BASE_LOCATION_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(BASE_LOCATION_EVENT, sync);
    };
  }, []);
  const set = useCallback((id: string | null) => {
    const had = readBaseLocation().recordId;
    writeBaseLocation({ recordId: id }, id && !had ? "push" : "replace");
    setState(id);
  }, []);
  return [recordId, set];
}
