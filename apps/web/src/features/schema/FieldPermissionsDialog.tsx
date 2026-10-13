import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "../../app/ui.tsx";
import { errorMessage } from "../../app/toast.tsx";
import { request, type FieldDto } from "../../lib/api.ts";
import { listBaseCollaborators } from "../../lib/api-areas/fields.ts";
import type { FieldEditLevel } from "../grid/grid-utils.ts";
import styles from "./field-permissions.module.css";

const LEVELS: { id: FieldEditLevel; label: string; hint: string }[] = [
  { id: "editors", label: "Editors and up", hint: "Collaborators with Editor, Creator, or Owner permissions (default setting)" },
  { id: "creators", label: "Creators and up", hint: "Collaborators with Creator or Owner permissions" },
  { id: "specific", label: "Specific users", hint: "A specific list of collaborators with Editor, Creator, or Owner permissions" },
  { id: "nobody", label: "Nobody", hint: "No collaborators" },
];

const EDIT_ROLES = new Set(["owner", "creator", "editor"]);

export function FieldPermissionsDialog({
  baseId,
  tableId,
  field,
  onClose,
}: {
  baseId: string;
  tableId: string;
  field: Pick<FieldDto, "id" | "name" | "editPermission">;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [level, setLevel] = useState<FieldEditLevel>(field.editPermission?.level ?? "editors");
  const [userIds, setUserIds] = useState<string[]>(field.editPermission?.userIds ?? []);
  const [open, setOpen] = useState(false);
  // The dialog body clips overflow, so the list is placed against the viewport.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const people = useQuery({ queryKey: ["base-collaborators", baseId], queryFn: () => listBaseCollaborators(baseId), staleTime: 60_000 });
  const editors = (people.data ?? []).filter((p) => EDIT_ROLES.has(p.role ?? ""));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const save = async (nextLevel: FieldEditLevel, nextUsers: string[]) => {
    if (nextLevel === "specific" && !nextUsers.length) return;
    setSaving(true);
    setError(null);
    try {
      await request(`/v1/bases/${baseId}/tables/${tableId}/fields/${field.id}/permissions`, {
        method: "PUT",
        json: { level: nextLevel, ...(nextLevel === "specific" ? { userIds: nextUsers } : {}) },
      });
      await qc.invalidateQueries({ queryKey: ["bases", baseId] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const pick = (id: FieldEditLevel) => {
    setOpen(false);
    setLevel(id);
    if (id === "specific") {
      const seed = userIds.length ? userIds : editors.filter((p) => p.role === "owner").map((p) => p.id);
      setUserIds(seed);
      void save(id, seed);
    } else void save(id, []);
  };

  const toggleUser = (id: string) => {
    const next = userIds.includes(id) ? userIds.filter((u) => u !== id) : [...userIds, id];
    setUserIds(next);
    if (next.length) void save("specific", next);
    else setError("Pick at least one person, or choose another option.");
  };

  const current = LEVELS.find((l) => l.id === level)!;
  return (
    <Dialog title="Field permissions" onClose={onClose}>
      <p className={styles.lead}>
        Limit who can edit values in <b>{field.name}</b>
      </p>
      <div className={styles.row}>
        <span className={styles.question}>Who can edit values in this field?</span>
        <div className={styles.selectWrap} ref={wrapRef}>
          <button
            type="button"
            className={styles.selectBtn}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Who can edit values in this field?"
            disabled={saving && !open}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
              setOpen(!open);
            }}
          >
            {current.label}
            <span className={styles.chev} aria-hidden>
              ⌄
            </span>
          </button>
          {open ? (
            <div className={styles.menu} style={menuPos ?? undefined} role="listbox" aria-label="Who can edit values">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected={l.id === level}
                  className={l.id === level ? styles.optionOn : styles.option}
                  onClick={() => pick(l.id)}
                >
                  <span className={styles.optionLabel}>
                    {l.label}
                    {l.id === level ? <span aria-hidden>✓</span> : null}
                  </span>
                  <span className={styles.optionHint}>{l.hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {level === "specific" ? (
        <div className={styles.people} aria-label="People who can edit this field">
          {people.isLoading ? <span className={styles.muted}>Loading collaborators…</span> : null}
          {editors.map((p) => (
            <label key={p.id} className={styles.person}>
              <input type="checkbox" checked={userIds.includes(p.id)} onChange={() => toggleUser(p.id)} />
              <span className={styles.personName}>{p.name || p.email}</span>
              <span className={styles.muted}>{p.email}</span>
              <span className={styles.role}>{p.role}</span>
            </label>
          ))}
          {!people.isLoading && !editors.length ? <span className={styles.muted}>No collaborators with Editor access or higher.</span> : null}
        </div>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <p className={styles.muted}>
        {saving ? "Saving…" : "Changes are saved straight away. People who can't edit this field still see its values."}
      </p>
    </Dialog>
  );
}
