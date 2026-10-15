import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { notificationsApi, relativeTime, type NotificationWire } from "../../lib/api-areas/collab.ts";
import { navigateToLink } from "../search/SearchPalette.tsx";
import styles from "./notifications.module.css";

const POLL_MS = 15_000;
/** Newest notification time this browser has already shown (or skipped) as a desktop alert. */
const DESKTOP_SEEN_KEY = "tableos:desktop-notified-at";

type DesktopPermission = NotificationPermission | "unsupported";

function desktopPermission(): DesktopPermission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "•"
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const qc = useQueryClient();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: (id: string) => notificationsApi.markRead(id), onSuccess: invalidate });
  const markUnread = useMutation({ mutationFn: (id: string) => notificationsApi.markUnread(id), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => notificationsApi.markAllRead(), onSuccess: invalidate });

  const unread = query.data?.unreadCount ?? 0;
  const all: NotificationWire[] = query.data?.notifications ?? [];
  const list = filter === "unread" ? all.filter((n) => !n.readAt) : all;
  const [permission, setPermission] = useState<DesktopPermission>(desktopPermission);

  function openItem(n: NotificationWire) {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) void navigateToLink(router, n.link);
  }
  const openItemRef = useRef(openItem);
  openItemRef.current = openItem;

  // Desktop alerts for notifications that arrived since this browser last looked. The first load
  // only records where we are, so turning alerts on never replays old notifications.
  useEffect(() => {
    const items = query.data?.notifications;
    if (!items) return;
    const newest = items.reduce((m, n) => Math.max(m, Date.parse(n.createdAt) || 0), 0);
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(DESKTOP_SEEN_KEY) ?? 0);
    } catch {
      return;
    }
    if (seen && permission === "granted") {
      const fresh = items.filter((n) => !n.readAt && (Date.parse(n.createdAt) || 0) > seen).slice(0, 3);
      for (const n of fresh) {
        const alert = new Notification(n.title, { body: n.body ?? "", tag: `tableos-${n.id}` });
        alert.onclick = () => {
          window.focus();
          openItemRef.current(n);
          alert.close();
        };
      }
    }
    if (newest > seen || !seen) localStorage.setItem(DESKTOP_SEEN_KEY, String(Math.max(newest, seen, 1)));
  }, [query.data, permission]);

  const askPermission = () => {
    if (permission === "unsupported") return;
    void Notification.requestPermission().then(setPermission);
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.bell}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unread > 0 ? <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Mark all as read
            </button>
          </div>
          {permission === "default" ? (
            <div className={styles.desktopRow}>
              <span>Get desktop notifications for new activity.</span>
              <button type="button" className={styles.desktopBtn} onClick={askPermission}>
                Turn on
              </button>
            </div>
          ) : permission === "denied" ? (
            <div className={styles.desktopRow}>
              <span>Desktop notifications are blocked. Allow them for this site in your browser settings.</span>
            </div>
          ) : permission === "granted" ? (
            <div className={styles.desktopRow}>
              <span>Desktop notifications are on.</span>
            </div>
          ) : null}
          <div className={styles.filters} role="tablist">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? styles.filterActive : styles.filter}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : `Unread${unread ? ` (${unread})` : ""}`}
              </button>
            ))}
          </div>
          <ul className={styles.list}>
            {query.isLoading ? <li className={styles.empty}>Loading…</li> : null}
            {query.isError ? <li className={styles.empty}>Couldn’t load notifications.</li> : null}
            {query.isSuccess && list.length === 0 ? (
              <li className={styles.empty}>
                {filter === "unread" ? "You’re all caught up." : "No notifications yet. Mentions and replies to your comments show up here."}
              </li>
            ) : null}
            {list.map((n) => (
              <li key={n.id} className={n.readAt ? styles.item : styles.itemUnread}>
                <button type="button" className={styles.itemMain} onClick={() => openItem(n)}>
                  <span className={styles.avatar} aria-hidden>
                    {initials(n.actor?.name ?? "")}
                  </span>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    {n.body ? <span className={styles.itemBody}>{n.body}</span> : null}
                    <span className={styles.itemMeta}>{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.dotBtn}
                  title={n.readAt ? "Mark as unread" : "Mark as read"}
                  aria-label={n.readAt ? "Mark as unread" : "Mark as read"}
                  onClick={() => (n.readAt ? markUnread.mutate(n.id) : markRead.mutate(n.id))}
                >
                  <span className={n.readAt ? styles.dotEmpty : styles.dot} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
