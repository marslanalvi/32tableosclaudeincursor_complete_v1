import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiProblemError } from "../../lib/api.ts";
import {
  commentsApi,
  listCollaborators,
  relativeTime,
  type Collaborator,
  type CommentWire,
} from "../../lib/api-areas/collab.ts";
import { formatBytes, listRecordAttachments, uploadAttachment, type AttachmentWire } from "../../lib/api-areas/files.ts";
import { ConfirmDialog } from "../grid/Menu.tsx";
import { COMMENT_MAX, LengthNote } from "../../app/ui.tsx";
import styles from "./comments.module.css";

const REACTIONS = ["👍", "❤️", "😄", "🎉", "👀", "✅"];
const MARKUP_RE = /@\[([^\]\n]{1,200})\]\((usr_[A-Za-z0-9]+)\)/g;
const AVATAR_COLORS = [
  "var(--tabula-color-signature-peach)",
  "var(--tabula-color-signature-mint)",
  "var(--tabula-color-signature-yellow)",
  "var(--tabula-color-signature-cream)",
  "var(--tabula-color-signature-mustard)",
];
const MAX_FILES = 10;

/**
 * Which comments to show (Airtable's activity menu):
 * all comments, comments on the record itself, comments on one of its attachments,
 * comments that carry files, or none (revision history only).
 */
export type CommentFilter = "all" | "record" | "on_attachments" | "with_attachments" | "none";

/** A non-comment entry (e.g. a revision) merged into the timeline by time. */
export interface TimelineItem {
  at: number;
  key: string;
  node: ReactNode;
}

function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function errorText(err: unknown): string {
  if (err instanceof ApiProblemError) return err.problem.detail ?? err.problem.title;
  return err instanceof Error ? err.message : "Something went wrong";
}

/** Render a body: mention markup → chips, keep line breaks. */
function renderBody(body: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of body.matchAll(MARKUP_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(body.slice(last, start));
    parts.push(
      <span key={`m${i++}`} className={styles.mention} title={m[2]}>
        @{m[1]}
      </span>,
    );
    last = start + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

/** Composer text uses `@Name`; convert known mentions to markup on send. */
function toMarkup(text: string, mentioned: Map<string, string>): string {
  let out = text;
  const names = [...mentioned.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    const id = mentioned.get(name)!;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|[^\\w\\]])@${escaped}(?![\\w])`, "g"), `$1@[${name}](${id})`);
  }
  return out;
}

/** Markup → composer text (for editing). */
function fromMarkup(body: string, mentioned: Map<string, string>): string {
  return body.replace(MARKUP_RE, (_m, name: string, id: string) => {
    mentioned.set(name, id);
    return `@${name}`;
  });
}

const isImage = (a: { mime: string }) => a.mime.startsWith("image/");

function fileIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime === "application/pdf") return "📕";
  if (mime.startsWith("video/")) return "🎞";
  if (mime.startsWith("audio/")) return "🎵";
  if (/sheet|excel|csv/.test(mime)) return "📊";
  return "📄";
}

/** What a comment carries besides text. */
export interface CommentDraft {
  body: string;
  attachmentIds: string[];
  targetAttachmentId: string | null;
}

interface PendingFile {
  key: string;
  name: string;
  progress: number;
  attachment?: AttachmentWire;
  error?: string;
}

export function CommentComposer({
  baseId,
  tableId,
  recordId,
  initial = "",
  placeholder,
  submitLabel,
  autoFocus,
  busy,
  allowFiles = false,
  onSubmit,
  onCancel,
}: {
  baseId: string;
  tableId?: string;
  recordId?: string;
  initial?: string;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  busy: boolean;
  /** Attach files and point the comment at one of the record's attachments. */
  allowFiles?: boolean;
  onSubmit: (draft: CommentDraft) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const mentioned = useRef(new Map<string, string>());
  const [text, setText] = useState(() => fromMarkup(initial, mentioned.current));
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [target, setTarget] = useState<string>("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const collaborators = useQuery({
    queryKey: ["collaborators", baseId],
    queryFn: () => listCollaborators(baseId),
    staleTime: 60_000,
    enabled: mention !== null,
  });
  const recordFiles = useQuery({
    queryKey: ["record-attachments", baseId, tableId, recordId],
    queryFn: () => listRecordAttachments(baseId, tableId!, recordId!),
    enabled: allowFiles && Boolean(tableId && recordId),
    staleTime: 30_000,
  });
  const recordAttachments = recordFiles.data?.attachments ?? [];
  const candidates: Collaborator[] = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return (collaborators.data?.collaborators ?? [])
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, collaborators.data]);

  function updateMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(before);
    if (m) {
      setMention({ start: caret - m[2]!.length - 1, query: m[2]! });
      setActive(0);
    } else {
      setMention(null);
    }
  }

  function pick(c: Collaborator) {
    if (!mention) return;
    const caret = ta.current?.selectionStart ?? text.length;
    const insert = `@${c.name} `;
    const next = text.slice(0, mention.start) + insert + text.slice(caret);
    mentioned.current.set(c.name, c.id);
    pendingCaret.current = mention.start + insert.length;
    setText(next);
    setMention(null);
  }

  useLayoutEffect(() => {
    const pos = pendingCaret.current;
    if (pos === null || !ta.current) return;
    pendingCaret.current = null;
    ta.current.focus();
    ta.current.setSelectionRange(pos, pos);
  }, [text]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_FILES - files.length;
    for (const file of [...list].slice(0, Math.max(0, room))) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      setFiles((fs) => [...fs, { key, name: file.name, progress: 0 }]);
      const patch = (p: Partial<PendingFile>) => setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));
      uploadAttachment(baseId, file, (progress) => patch({ progress }))
        .then((attachment) => patch({ attachment, progress: 1 }))
        .catch((e: unknown) => patch({ error: errorText(e) }));
    }
  }

  const uploading = files.some((f) => !f.attachment && !f.error);
  const ready = files.filter((f) => f.attachment).map((f) => f.attachment!.id);
  const canSend = (text.trim().length > 0 || ready.length > 0) && !uploading && !busy;

  async function submit() {
    if (!canSend) return;
    await onSubmit({ body: toMarkup(text.trim(), mentioned.current), attachmentIds: ready, targetAttachmentId: target || null });
    setText("");
    setFiles([]);
    setTarget("");
    mentioned.current.clear();
  }

  return (
    <div
      className={styles.composer}
      onDragOver={(e) => {
        if (allowFiles && e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!allowFiles || !e.dataTransfer.files.length) return;
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      {allowFiles && target ? (
        <div className={styles.targetBar}>
          <span>
            Commenting on <b>{recordAttachments.find((a) => a.id === target)?.filename ?? "attachment"}</b>
          </span>
          <button type="button" className={styles.actionBtn} onClick={() => setTarget("")} aria-label="Comment on the record instead">
            ✕
          </button>
        </div>
      ) : null}
      <textarea
        ref={ta}
        className={styles.textarea}
        value={text}
        rows={2}
        maxLength={COMMENT_MAX}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          updateMention(e.target.value, e.target.selectionStart);
        }}
        onPaste={(e) => {
          if (allowFiles && e.clipboardData.files.length) {
            e.preventDefault();
            addFiles(e.clipboardData.files);
          }
        }}
        onKeyDown={(e) => {
          if (mention && candidates.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % candidates.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + candidates.length) % candidates.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(candidates[active]!);
              return;
            }
          }
          if (e.key === "Escape") {
            if (mention) setMention(null);
            else onCancel?.();
            return;
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <LengthNote length={text.length} max={COMMENT_MAX} what="Comments" />
      {mention && candidates.length ? (
        <ul className={styles.mentionMenu} role="listbox" aria-label="Mention someone">
          {candidates.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? styles.mentionOptionActive : styles.mentionOption}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
            >
              <span className={styles.avatarSm} style={{ background: colorFor(c.id) }}>
                {initialsOf(c.name)}
              </span>
              <span>
                <span className={styles.mentionName}>{c.name}</span>
                <span className={styles.mentionEmail}>{c.email}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {files.length ? (
        <ul className={styles.pendingFiles} aria-label="Files to attach">
          {files.map((f) => (
            <li key={f.key} className={f.error ? styles.pendingFileError : styles.pendingFile} title={f.error ?? f.name}>
              <span className={styles.pendingName}>{f.name}</span>
              <span className={styles.pendingState}>
                {f.error ? "Failed" : f.attachment ? formatBytes(f.attachment.size) : `${Math.round(f.progress * 100)}%`}
              </span>
              <button
                type="button"
                className={styles.pendingRemove}
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.composerActions}>
        {allowFiles ? (
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.toolBtn}
              title="Attach files"
              aria-label="Attach files"
              disabled={files.length >= MAX_FILES}
              onClick={() => fileInput.current?.click()}
            >
              📎
            </button>
            {recordAttachments.length ? (
              <select
                className={styles.targetSelect}
                aria-label="Comment on an attachment"
                title="Comment on one of this record's attachments"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">On this record</option>
                {recordAttachments.map((a) => (
                  <option key={a.id} value={a.id}>
                    On {a.filename}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}
        <span className={styles.hint}>@ to mention · Ctrl+Enter to send</span>
        {onCancel ? (
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" className={styles.btnPrimary} disabled={!canSend} onClick={() => void submit()}>
          {uploading ? "Uploading…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function AttachmentTiles({ files }: { files: AttachmentWire[] }) {
  if (!files.length) return null;
  return (
    <div className={styles.files}>
      {files.map((a) =>
        isImage(a) ? (
          <a key={a.id} className={styles.fileThumb} href={a.url} target="_blank" rel="noreferrer" title={a.filename}>
            <img src={a.thumbnailUrl ?? a.url} alt={a.filename} loading="lazy" />
          </a>
        ) : (
          <a key={a.id} className={styles.fileChip} href={a.url} target="_blank" rel="noreferrer" title={a.filename}>
            <span aria-hidden>{fileIcon(a.mime)}</span>
            <span className={styles.fileName}>{a.filename}</span>
            <span className={styles.fileSize}>{formatBytes(a.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}

/** Does a thread match the activity filter? (`with_attachments` also looks at replies.) */
function threadMatches(root: CommentWire, replies: CommentWire[], filter: CommentFilter): boolean {
  switch (filter) {
    case "none":
      return false;
    case "record":
      return !root.target;
    case "on_attachments":
      return Boolean(root.target);
    case "with_attachments":
      return [root, ...replies].some((c) => (c.attachments?.length ?? 0) > 0);
    default:
      return true;
  }
}

const EMPTY_TEXT: Record<CommentFilter, string> = {
  all: "No comments yet. Start the conversation, and @mention teammates to notify them.",
  record: "No comments on this record yet.",
  on_attachments: "No comments on this record's attachments. Choose an attachment next to 📎 to comment on it.",
  with_attachments: "No comments with files yet. Use 📎, paste or drop files to attach them.",
  none: "No revisions yet.",
};

/**
 * Record comments (CONTRACTS §10), mounted in the record drawer's activity panel.
 * Threads can be resolved, carry files, or point at one of the record's attachments.
 * `timeline` entries (revisions) are interleaved by time, oldest first, with the composer below.
 */
export function RecordComments({
  baseId,
  tableId,
  recordId,
  filter = "all",
  showResolved = false,
  canComment = true,
  timeline = [],
  hideCommentsBefore = -Infinity,
  top,
  footer,
  loadingTimeline = false,
}: {
  baseId: string;
  tableId: string;
  recordId: string;
  filter?: CommentFilter;
  showResolved?: boolean;
  canComment?: boolean;
  timeline?: TimelineItem[];
  /** Comments older than the loaded revisions would interleave wrongly; hold them until they load. */
  hideCommentsBefore?: number;
  /** Rendered above the list (e.g. "Show older activity"). */
  top?: ReactNode;
  /** Rendered under the list (e.g. a retention note). */
  footer?: ReactNode;
  loadingTimeline?: boolean;
}) {
  const qc = useQueryClient();
  const key = ["comments", baseId, tableId, recordId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => commentsApi.list(baseId, tableId, recordId),
    refetchInterval: 20_000,
    enabled: filter !== "none",
  });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const refresh = () => {
    setError(null);
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const onError = (e: unknown) => setError(errorText(e));

  const create = useMutation({
    mutationFn: (v: CommentDraft & { parentId?: string | null }) => commentsApi.create(baseId, tableId, recordId, v),
    onSuccess: () => {
      setReplyTo(null);
      stickToBottom.current = true;
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; body: string }) => commentsApi.update(baseId, v.id, v.body),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => commentsApi.remove(baseId, id),
    onSuccess: refresh,
    onError,
  });
  const resolve = useMutation({
    mutationFn: (v: { id: string; resolved: boolean }) => commentsApi.resolve(baseId, v.id, v.resolved),
    onSuccess: refresh,
    onError,
  });
  const react = useMutation({
    mutationFn: (v: { id: string; emoji: string }) => commentsApi.toggleReaction(baseId, v.id, v.emoji),
    onMutate: async (v) => {
      // Optimistic toggle.
      qc.setQueryData(key, (old: { comments: CommentWire[] } | undefined) =>
        old
          ? {
              comments: old.comments.map((c) => {
                if (c.id !== v.id) return c;
                const existing = c.reactions.find((r) => r.emoji === v.emoji);
                let reactions = c.reactions;
                if (existing?.reactedByMe) {
                  reactions = c.reactions
                    .map((r) => (r.emoji === v.emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r))
                    .filter((r) => r.count > 0);
                } else if (existing) {
                  reactions = c.reactions.map((r) =>
                    r.emoji === v.emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r,
                  );
                } else {
                  reactions = [...c.reactions, { emoji: v.emoji, count: 1, userIds: [], userNames: [], reactedByMe: true }];
                }
                return { ...c, reactions };
              }),
            }
          : old,
      );
      setPickerFor(null);
    },
    onSettled: refresh,
    onError,
  });

  const comments = useMemo(() => query.data?.comments ?? [], [query.data]);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);
  const roots = comments.filter((c) => !c.parentId || !comments.some((p) => p.id === c.parentId));
  const visibleRoots = roots.filter(
    (c) => (showResolved || !c.resolved) && threadMatches(c, repliesOf(c.id), filter) && Date.parse(c.createdAt) >= hideCommentsBefore,
  );
  const hiddenResolved = filter === "none" || showResolved ? 0 : roots.filter((c) => c.resolved && threadMatches(c, repliesOf(c.id), filter)).length;

  function renderComment(c: CommentWire, isReply: boolean) {
    const name = c.author?.name ?? c.authorName ?? "Unknown";
    return (
      <div className={isReply ? styles.reply : styles.comment} data-testid="comment">
        <span className={styles.avatar} style={{ background: colorFor(c.author?.id ?? c.id) }} aria-hidden>
          {c.author?.initials ?? initialsOf(name)}
        </span>
        <div className={styles.main}>
          <div className={styles.meta}>
            <span className={styles.author}>{name}</span>
            <time className={styles.time} dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
              {relativeTime(c.createdAt)}
            </time>
            {c.edited ? <span className={styles.time}>(edited)</span> : null}
          </div>
          {c.target ? (
            <a
              className={styles.targetChip}
              href={c.target.attachment?.url}
              target="_blank"
              rel="noreferrer"
              title={`Comment on ${c.target.filename}`}
            >
              {c.target.attachment && isImage(c.target.attachment) ? (
                <img src={c.target.attachment.thumbnailUrl ?? c.target.attachment.url} alt="" />
              ) : (
                <span aria-hidden>{fileIcon(c.target.attachment?.mime ?? "")}</span>
              )}
              <span>On {c.target.filename}</span>
            </a>
          ) : null}
          {editing === c.id ? (
            <CommentComposer
              baseId={baseId}
              initial={c.body}
              placeholder="Edit comment"
              submitLabel="Save"
              autoFocus
              busy={update.isPending}
              onSubmit={(d) => update.mutateAsync({ id: c.id, body: d.body }).then(() => undefined)}
              onCancel={() => setEditing(null)}
            />
          ) : c.body ? (
            <div className={styles.body}>{renderBody(c.body)}</div>
          ) : null}
          <AttachmentTiles files={c.attachments ?? []} />
          <div className={styles.actions}>
            {c.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={r.reactedByMe ? styles.reactionMine : styles.reaction}
                title={r.userNames.filter(Boolean).join(", ")}
                onClick={() => react.mutate({ id: c.id, emoji: r.emoji })}
              >
                {r.emoji} <span>{r.count}</span>
              </button>
            ))}
            {canComment ? (
              <span className={styles.pickerWrap}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  aria-label="Add reaction"
                  onClick={() => setPickerFor(pickerFor === c.id ? null : c.id)}
                >
                  ☺+
                </button>
                {pickerFor === c.id ? (
                  <span className={styles.picker} role="menu">
                    {REACTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        role="menuitem"
                        className={styles.pickerBtn}
                        onClick={() => {
                          react.mutate({ id: c.id, emoji: e });
                          setPickerFor(null);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </span>
                ) : null}
              </span>
            ) : null}
            {!isReply && canComment ? (
              <button type="button" className={styles.actionBtn} onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                Reply
              </button>
            ) : null}
            {!isReply && canComment ? (
              <button
                type="button"
                className={styles.actionBtn}
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: c.id, resolved: !c.resolved })}
              >
                {c.resolved ? "Reopen" : "Resolve"}
              </button>
            ) : null}
            {c.isMine && editing !== c.id ? (
              <>
                {c.body ? (
                  <button type="button" className={styles.actionBtn} onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                ) : null}
                <button type="button" className={styles.actionBtnDanger} onClick={() => setConfirmDelete(c.id)}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderThread(c: CommentWire) {
    const replies = repliesOf(c.id);
    return (
      <li key={c.id} className={c.resolved ? styles.threadResolved : styles.threadItem} data-testid="comment-thread">
        {c.resolved ? (
          <div className={styles.resolvedBar}>
            ✓ Resolved{c.resolved.by?.name ? ` by ${c.resolved.by.name}` : ""} · {relativeTime(c.resolved.at)}
          </div>
        ) : null}
        {renderComment(c, false)}
        {replies.length || replyTo === c.id ? (
          <div className={styles.thread}>
            {replies.map((r) => (
              <Fragment key={r.id}>{renderComment(r, true)}</Fragment>
            ))}
            {replyTo === c.id ? (
              <CommentComposer
                baseId={baseId}
                tableId={tableId}
                recordId={recordId}
                allowFiles
                placeholder={`Reply to ${c.author?.name ?? "comment"}`}
                submitLabel="Reply"
                autoFocus
                busy={create.isPending}
                onSubmit={(d) => create.mutateAsync({ ...d, targetAttachmentId: null, parentId: c.id }).then(() => undefined)}
                onCancel={() => setReplyTo(null)}
              />
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  const items = [
    ...timeline,
    ...visibleRoots.map((c) => ({ at: Date.parse(c.createdAt), key: `c${c.id}`, node: renderThread(c) })),
  ].sort((a, b) => a.at - b.at);
  const loading = loadingTimeline || (filter !== "none" && query.isLoading);

  // Open at the newest entry, and follow new entries while the reader is at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [items.length, loading]);

  return (
    <section className={styles.panel} aria-label="Comments">
      <div
        ref={scroller}
        className={styles.scroll}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {top}
        {loading ? <p className={styles.empty}>Loading…</p> : null}
        {query.isError ? <p className={styles.error}>{errorText(query.error)}</p> : null}
        {!loading && items.length === 0 ? <p className={styles.empty}>{timeline.length || filter === "none" ? EMPTY_TEXT.none : EMPTY_TEXT[filter]}</p> : null}
        <ul className={styles.list} data-testid="activity-list">
          {items.map((it) => (
            <Fragment key={it.key}>{it.node}</Fragment>
          ))}
        </ul>
        {hiddenResolved ? (
          <p className={styles.empty}>
            {hiddenResolved} resolved {hiddenResolved === 1 ? "thread" : "threads"} hidden. Turn on “Show resolved comments” in the menu above to see{" "}
            {hiddenResolved === 1 ? "it" : "them"}.
          </p>
        ) : null}
        {footer}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {canComment && filter !== "none" ? (
        <div className={styles.dock}>
          <CommentComposer
            baseId={baseId}
            tableId={tableId}
            recordId={recordId}
            allowFiles
            placeholder="Leave a comment"
            submitLabel="Comment"
            busy={create.isPending}
            onSubmit={(d) => create.mutateAsync(d).then(() => undefined)}
          />
        </div>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this comment?"
          body="Replies to it are deleted too. This can’t be undone."
          confirmLabel="Delete comment"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            remove.mutate(confirmDelete);
            setConfirmDelete(null);
          }}
        />
      ) : null}
    </section>
  );
}

export default RecordComments;
