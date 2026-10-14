import { useEffect, useRef, useState, type ReactNode } from "react";
import { downloadHref, openAttachmentViewer } from "./AttachmentViewer.js";
import { useFieldUiServices } from "./services.js";
import { ensureFieldUiStyles } from "./styles.js";
import type { AttachmentValue } from "./types.js";

function sizeText(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ext(a: AttachmentValue): string {
  return (/\.([a-z0-9]{1,5})$/i.exec(a.filename)?.[1] ?? a.mime?.split("/")[1] ?? "file").slice(0, 4).toUpperCase();
}

/**
 * Expanded attachment cell: every file large, with open, download, delete, drag to reorder
 * and upload (button or drop). `readOnly` hides the editing controls.
 */
export function AttachmentsDialog({
  title,
  value,
  readOnly = false,
  onChange,
  onClose,
}: {
  title: string;
  value: AttachmentValue[];
  readOnly?: boolean;
  onChange: (next: AttachmentValue[] | null) => void;
  onClose: () => void;
}): ReactNode {
  ensureFieldUiStyles();
  const services = useFieldUiServices();
  const [items, setItems] = useState(value);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => setItems(value), [JSON.stringify(value.map((a) => a.id))]); // eslint-disable-line react-hooks/exhaustive-deps
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canUpload = !readOnly && Boolean(services.uploadAttachment);

  const commit = (next: AttachmentValue[]) => {
    itemsRef.current = next;
    setItems(next);
    onChange(next.length ? next : null);
  };
  const remove = (id: string) => commit(itemsRef.current.filter((a) => a.id !== id));
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = itemsRef.current.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    commit(next);
  };
  const upload = async (files: FileList | File[]) => {
    if (!services.uploadAttachment) return;
    setError(null);
    for (const file of Array.from(files)) {
      try {
        setProgress(0);
        const att = await services.uploadAttachment(file, (f) => setProgress(f));
        commit([...itemsRef.current, att]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setProgress(null);
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".tfu-av")) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const view = (i: number) =>
    openAttachmentViewer({ items: itemsRef.current, index: i, ...(readOnly ? {} : { onRemove: remove }) });

  const dialog = (
    <div
      className="tfu-modal-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`tfu-modal tfu-attdlg ${dropOver ? "tfu-attdlg-drop" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onDragOver={(e) => {
          if (!canUpload || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDropOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropOver(false);
        }}
        onDrop={(e) => {
          if (!canUpload || !e.dataTransfer.files.length) return;
          e.preventDefault();
          setDropOver(false);
          void upload(e.dataTransfer.files);
        }}
      >
        <div className="tfu-modal-head">
          <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</strong>
          <span className="tfu-muted">
            {items.length} {items.length === 1 ? "file" : "files"}
          </span>
          <button type="button" className="tfu-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="tfu-modal-body tfu-attdlg-body">
          {items.length === 0 ? <p className="tfu-muted" style={{ padding: 12 }}>No files yet.</p> : null}
          <div className="tfu-attdlg-grid">
            {items.map((a, i) => {
              const isImage = (a.mime ?? "").startsWith("image/");
              const src = a.thumbnailUrl ?? (isImage ? a.url : null);
              return (
                <div
                  key={a.id}
                  className={`tfu-attdlg-card ${dragFrom === i ? "tfu-attdlg-dragging" : ""}`}
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", a.id);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  onDragOver={(e) => {
                    if (dragFrom === null) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    if (dragFrom === null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    move(dragFrom, i);
                    setDragFrom(null);
                  }}
                >
                  <button type="button" className="tfu-attdlg-thumb" title={`Open ${a.filename}`} onClick={() => view(i)}>
                    {src ? <img src={src} alt={a.filename} loading="lazy" /> : <span>{ext(a)}</span>}
                  </button>
                  <div className="tfu-attdlg-name" title={a.filename}>
                    {a.filename}
                  </div>
                  <div className="tfu-attdlg-meta">
                    <span className="tfu-muted">{sizeText(a.size)}</span>
                    <span style={{ flex: 1 }} />
                    {a.url ? (
                      <a className="tfu-attdlg-act" href={downloadHref(a)} download={a.filename} title={`Download ${a.filename}`}>
                        Download
                      </a>
                    ) : null}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="tfu-attdlg-act tfu-btn-danger"
                        title={`Delete ${a.filename}`}
                        onClick={() => {
                          if (window.confirm(`Delete "${a.filename}" from this record?`)) remove(a.id);
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {canUpload ? (
          <div className="tfu-attdlg-foot">
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className="tfu-btn tfu-btn-primary" disabled={progress !== null} onClick={() => fileRef.current?.click()}>
              {progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : "+ Attach files"}
            </button>
            <span className="tfu-muted">or drop files here. Drag cards to reorder.</span>
            {error ? <span className="tfu-error">{error}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
  return services.portal ? services.portal(dialog) : dialog;
}
