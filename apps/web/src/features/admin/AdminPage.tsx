import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  adminApi,
  type ApiTokenInfo,
  type BaseGrantRole,
  type DeviceLogMember,
  type GrantRole,
  type OrgAccess,
  type OrgMember,
  type OrgRole,
  type TokenScope,
  type WorkspaceGrantRole,
} from "../../lib/api-areas/admin.ts";
import { accountApi } from "../../lib/api-areas/account.ts";
import { ApiProblemError } from "../../lib/api.ts";
import { copyText } from "../../lib/ids.ts";
import account from "../account/account.module.css";
import styles from "./admin.module.css";

const ROLES: { value: GrantRole; label: string; hint: string }[] = [
  { value: "creator", label: "Creator", hint: "Full control: edit data, change fields, tables and views" },
  { value: "editor", label: "Editor", hint: "Add, edit and delete records; create personal views" },
  { value: "commenter", label: "Commenter", hint: "Read everything and add comments" },
  { value: "viewer", label: "Viewer", hint: "Read only" },
];
/** Workspaces only: everything a Creator can do, plus rename or delete the workspace. */
const WS_OWNER = { value: "owner" as const, label: "Workspace Owner", hint: "Creator on every base, and may rename or delete the workspace" };

const ACCOUNT_TYPES: { value: OrgRole; label: string; hint: string }[] = [
  { value: "member", label: "Member", hint: "Opens only what they're given" },
  { value: "admin", label: "Admin", hint: "Manages Members and the workspaces and bases they're given; no billing" },
  { value: "owner", label: "Owner", hint: "Everything, including Admins, Owners and billing" },
];
const accountLabel = (r: string) => ACCOUNT_TYPES.find((a) => a.value === r)?.label ?? r;

export type AdminTab = "people" | "devices" | "tokens" | "settings";

function errorText(err: unknown): string {
  if (err instanceof ApiProblemError) {
    const p = err.problem as { detail?: string; title?: string; errors?: { message: string }[] };
    return p.errors?.[0]?.message ?? p.detail ?? p.title ?? "Something went wrong";
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
/** End of the chosen local day, so "until 12 Oct" includes 12 Oct. */
const fromDateInput = (v: string) => (v ? new Date(`${v}T23:59:59`).toISOString() : null);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function Section({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={account.section}>
      <div className={styles.sectionHeadRow}>
        <div className={account.sectionHead}>
          <h2 className={account.sectionTitle}>{title}</h2>
          {description ? <p className={account.muted}>{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className={account.sectionBody}>{children}</div>
    </section>
  );
}

function useAccess(orgId: string) {
  return useQuery({ queryKey: ["admin", "access", orgId], queryFn: () => adminApi.access(orgId), enabled: !!orgId });
}

function useInvalidateAccess(orgId: string) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["admin", "access", orgId] });
}

/* ------------------------------------------------------------------ people */

/**
 * The one invite form (Members & access → People, and Share on Home). Owners also choose the
 * account type; Admins invite Members to what they manage.
 */
export function InviteForm({
  orgId,
  data,
  defaultScope = "bases",
  onInvited,
}: {
  orgId: string;
  data: OrgAccess;
  /** "bases", or `wsp:<id>` to start with that whole workspace. */
  defaultScope?: string;
  onInvited?: () => void;
}) {
  const refresh = useInvalidateAccess(orgId);
  const isOwner = data.me?.role === "owner";
  const [email, setEmail] = useState("");
  /** "bases" = only the ticked bases; `wsp:<id>` = the whole workspace; "org" = no data yet. */
  const [scope, setScope] = useState<string>(defaultScope);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<WorkspaceGrantRole>("editor");
  const [orgRole, setOrgRole] = useState<OrgRole>("member");
  const [link, setLink] = useState<string | null>(null);
  const isWorkspace = scope.startsWith("wsp:");
  const invite = useMutation({
    mutationFn: () =>
      accountApi.createInvitation({
        email: email.trim(),
        ...(orgRole !== "member" ? { orgRole } : {}),
        ...(scope === "org"
          ? { organizationId: orgId }
          : {
              role: !isWorkspace && role === "owner" ? "creator" : role,
              ...(scope === "bases" ? { baseIds: [...picked] } : { workspaceId: scope.slice(4) }),
            }),
      }),
    onSuccess: (res) => {
      setLink(res.invitation.acceptUrl);
      setEmail("");
      setPicked(new Set());
      refresh();
      onInvited?.();
    },
  });
  const toggle = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  const ready = Boolean(email.trim()) && (scope !== "bases" || picked.size > 0);
  const roleChoices = isWorkspace ? [WS_OWNER, ...ROLES] : ROLES;
  return (
    <form
      className={`${styles.inviteRow} ${isOwner ? styles.inviteRowOwner : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) invite.mutate();
      }}
    >
      <input className={account.input} type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      {isOwner ? (
        <select
          className={account.input}
          value={orgRole}
          onChange={(e) => {
            const v = e.target.value as OrgRole;
            setOrgRole(v);
            if (v === "member" && scope === "org") setScope("bases");
          }}
          aria-label="Account type"
          title="Members open only what they're given. Admins manage Members. Owners manage everything."
        >
          {ACCOUNT_TYPES.map((a) => (
            <option key={a.value} value={a.value} title={a.hint}>
              {a.label}
            </option>
          ))}
        </select>
      ) : null}
      <select className={account.input} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Give access to">
        {orgRole !== "member" ? <option value="org">No workspace or base yet</option> : null}
        <option value="bases">Selected bases only</option>
        {data.workspaces
          .filter((w) => w.manageable !== false)
          .map((w) => (
            <option key={w.id} value={`wsp:${w.id}`}>
              Workspace · {w.name} (all its bases)
            </option>
          ))}
      </select>
      <select
        className={account.input}
        value={!isWorkspace && role === "owner" ? "creator" : role}
        disabled={scope === "org"}
        onChange={(e) => setRole(e.target.value as WorkspaceGrantRole)}
        aria-label="Role"
      >
        {roleChoices.map((r) => (
          <option key={r.value} value={r.value} title={r.hint}>
            {r.label}
          </option>
        ))}
      </select>
      <button type="submit" className={account.primary} disabled={invite.isPending || !ready}>
        {invite.isPending ? "Inviting…" : picked.size > 1 && scope === "bases" ? `Invite to ${picked.size} bases` : "Invite"}
      </button>
      {scope === "bases" ? (
        <div className={`${styles.full} ${styles.basePicker}`} role="group" aria-label="Bases to give access to">
          {data.workspaces.map((w) => {
            const ids = w.bases.map((b) => b.id);
            const all = ids.length > 0 && ids.every((id) => picked.has(id));
            return (
              <div key={w.id} className={styles.basePickerGroup}>
                <label className={styles.basePickerHead}>
                  <input type="checkbox" checked={all} disabled={!ids.length} onChange={(e) => toggle(ids, e.target.checked)} />
                  {w.name}
                  <span className={account.muted}>{ids.length ? "select all" : "no bases"}</span>
                </label>
                {w.bases.map((b) => (
                  <label key={b.id} className={styles.basePickerItem}>
                    <input type="checkbox" checked={picked.has(b.id)} onChange={(e) => toggle([b.id], e.target.checked)} />
                    {b.name}
                  </label>
                ))}
              </div>
            );
          })}
          <span className={account.muted}>
            {picked.size ? `${picked.size} base${picked.size === 1 ? "" : "s"} selected. They won't see the other bases in these workspaces.` : "Tick the bases this person may open."}
          </span>
        </div>
      ) : null}
      {invite.isError ? <div className={account.error}>{errorText(invite.error)}</div> : null}
      {link ? (
        <div className={`${account.ok} ${styles.full}`}>
          Invitation sent. You can also share this link: <code className={account.code}>{link}</code>{" "}
          <button type="button" className={styles.linkBtn} onClick={() => void copyText(link)}>
            Copy
          </button>
        </div>
      ) : null}
    </form>
  );
}

function AccessRow({
  orgId,
  member,
  label,
  indent,
  scope,
  inherited,
  selected,
  onSelect,
  manageable = true,
}: {
  orgId: string;
  member: OrgMember;
  label: string;
  indent: boolean;
  scope: { workspaceId: string } | { baseId: string };
  inherited: string | null;
  selected: boolean;
  onSelect: (on: boolean) => void;
  /** False: an Admin who may manage bases in this workspace but not the workspace itself. */
  manageable?: boolean;
}) {
  const refresh = useInvalidateAccess(orgId);
  const isBase = "baseId" in scope;
  const id = isBase ? scope.baseId : scope.workspaceId;
  const grant = member.grants.find((g) => g.resourceId === id);
  const blocked = grant?.role === "none";
  const save = useMutation({
    mutationFn: (body: { role: BaseGrantRole | null; expiresAt?: string | null }) => adminApi.setGrant(orgId, member.id, { ...scope, ...body }),
    onSettled: refresh,
  });
  return (
    <tr className={selected ? styles.rowSelected : undefined}>
      <td className={styles.pickCell}>
        <input type="checkbox" checked={selected} disabled={!manageable} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${label}`} />
      </td>
      <td className={indent ? styles.indent : styles.strong}>{label}</td>
      <td>
        <select
          className={`${account.input} ${styles.compact}`}
          value={grant?.role ?? ""}
          disabled={save.isPending || !manageable}
          title={manageable ? undefined : "You can't change access to this whole workspace"}
          onChange={(e) =>
            save.mutate({ role: (e.target.value || null) as BaseGrantRole | null, expiresAt: e.target.value === "none" ? null : (grant?.expiresAt ?? null) })
          }
          aria-label={`Role on ${label}`}
        >
          <option value="">{inherited ? `Inherit (${inherited})` : "No access"}</option>
          {(isBase ? ROLES : [WS_OWNER, ...ROLES]).map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          {isBase && inherited ? <option value="none">No access to this base</option> : null}
        </select>
      </td>
      <td>
        <input
          type="date"
          className={`${account.input} ${styles.compact}`}
          disabled={!grant || blocked || save.isPending || !manageable}
          value={toDateInput(grant?.expiresAt ?? null)}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => grant && save.mutate({ role: grant.role as GrantRole, expiresAt: fromDateInput(e.target.value) })}
          aria-label={`Access until on ${label}`}
        />
      </td>
      <td className={styles.state}>
        {save.isError ? (
          <span className={styles.bad}>{errorText(save.error)}</span>
        ) : blocked ? (
          <span className={styles.bad}>Blocked</span>
        ) : grant?.expired ? (
          <span className={styles.bad}>Expired</span>
        ) : grant?.expiresAt ? (
          "Time-limited"
        ) : grant ? (
          "No end date"
        ) : (
          ""
        )}
        {grant && manageable ? (
          <button
            type="button"
            className={styles.linkBtn}
            disabled={save.isPending}
            title={isBase && inherited ? "Back to the workspace role" : "Remove this access"}
            onClick={() => save.mutate({ role: null })}
          >
            {isBase && inherited ? "Reset" : "Remove"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

/** Set one role (or remove access) on every selected workspace/base row at once. */
function BulkAccessBar({
  orgId,
  member,
  data,
  selected,
  onDone,
}: {
  orgId: string;
  member: OrgMember;
  data: OrgAccess;
  selected: Set<string>;
  onDone: () => void;
}) {
  const refresh = useInvalidateAccess(orgId);
  const [role, setRole] = useState<GrantRole | "remove">("editor");
  const apply = useMutation({
    mutationFn: async () => {
      for (const key of selected) {
        const [kind, id] = key.split(":") as ["wsp" | "bas", string];
        if (kind === "wsp") {
          await adminApi.setGrant(orgId, member.id, { workspaceId: id, role: role === "remove" ? null : role });
          continue;
        }
        const ws = data.workspaces.find((w) => w.bases.some((b) => b.id === id));
        const inherits = Boolean(ws && member.grants.some((g) => g.resourceId === ws.id && g.role) && !selected.has(`wsp:${ws.id}`));
        await adminApi.setGrant(orgId, member.id, { baseId: id, role: role === "remove" ? (inherits ? "none" : null) : role });
      }
    },
    onSettled: () => {
      refresh();
      onDone();
    },
  });
  return (
    <div className={styles.bulkBar} role="toolbar" aria-label="Change selected">
      <span>
        {selected.size} selected
      </span>
      <select className={`${account.input} ${styles.compact}`} value={role} onChange={(e) => setRole(e.target.value as GrantRole | "remove")} aria-label="Role for selected">
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
        <option value="remove">No access</option>
      </select>
      <button type="button" className={account.primary} disabled={apply.isPending} onClick={() => apply.mutate()}>
        {apply.isPending ? "Applying…" : "Apply to selected"}
      </button>
      <button type="button" className={styles.linkBtn} onClick={onDone}>
        Clear selection
      </button>
      {apply.isError ? <span className={styles.bad}>{errorText(apply.error)}</span> : null}
    </div>
  );
}

function MemberCard({ orgId, member, data }: { orgId: string; member: OrgMember; data: OrgAccess }) {
  const refresh = useInvalidateAccess(orgId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const status = useMutation({
    mutationFn: (s: "active" | "suspended") => adminApi.setMemberStatus(orgId, member.id, s),
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: () => adminApi.removeMember(orgId, member.id), onSettled: refresh });
  const qc = useQueryClient();
  const afterRole = () => {
    refresh();
    void qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
    void qc.invalidateQueries({ queryKey: ["workspaces"] });
  };
  const setRole = useMutation({ mutationFn: (r: OrgRole) => adminApi.setOrgRole(orgId, member.id, r), onSettled: afterRole });
  const transfer = useMutation({ mutationFn: () => adminApi.transferOwnership(orgId, member.id), onSettled: afterRole });
  const iAmOwner = data.me?.role === "owner";
  const pending = member.devices.filter((d) => d.status === "pending").length;
  const approved = member.devices.filter((d) => d.status === "approved").length;
  const summary = member.isOwner
    ? "Owner · full access to everything"
    : member.grants.length === 0
      ? member.orgRole === "admin"
        ? "Admin · no workspaces or bases given yet"
        : "No access yet"
      : `${member.orgRole === "admin" ? "Admin · " : ""}${member.grants.length} access rule${member.grants.length === 1 ? "" : "s"}`;
  return (
    <li className={styles.member}>
      <div className={styles.memberHead}>
        <div className={account.sessionText}>
          <span className={account.sessionName}>
            {member.name || member.email}
            {member.isOwner ? <span className={account.badgeOn}>Owner</span> : null}
            {member.orgRole === "admin" ? <span className={styles.roleBadge}>Admin</span> : null}
            {member.isMe ? <span className={styles.roleBadge}>You</span> : null}
            {member.status === "suspended" ? <span className={styles.badgeWarn}>Suspended</span> : null}
            {pending ? <span className={styles.badgeWarn}>{pending} device{pending === 1 ? "" : "s"} waiting</span> : null}
          </span>
          <span className={account.muted}>
            {member.email} · {summary}
            {!member.isOwner ? ` · ${approved} approved device${approved === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        {iAmOwner ? (
          <div className={account.actions}>
            <select
              className={`${account.input} ${styles.compact}`}
              value={member.orgRole}
              disabled={setRole.isPending}
              aria-label={`Account type of ${member.name || member.email}`}
              onChange={(e) => {
                const r = e.target.value as OrgRole;
                const who = member.isMe ? "yourself" : member.name || member.email;
                if (window.confirm(`Make ${who} ${accountLabel(r)}?`)) setRole.mutate(r);
              }}
            >
              {ACCOUNT_TYPES.map((a) => (
                <option key={a.value} value={a.value} title={a.hint}>
                  {a.label}
                </option>
              ))}
            </select>
            {!member.isMe && !member.isOwner && member.status === "active" ? (
              <button
                type="button"
                className={styles.linkBtn}
                disabled={transfer.isPending}
                onClick={() => {
                  if (window.confirm(`Hand ownership to ${member.name || member.email}? They become Owner and you become Admin.`)) transfer.mutate();
                }}
              >
                Transfer ownership
              </button>
            ) : null}
          </div>
        ) : null}
        {member.canManage && !member.isOwner ? (
          <div className={account.actions}>
            <button type="button" className={account.secondary} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? "Done" : "Edit access"}
            </button>
            <button
              type="button"
              className={account.secondary}
              disabled={status.isPending}
              onClick={() => status.mutate(member.status === "active" ? "suspended" : "active")}
            >
              {member.status === "active" ? "Suspend" : "Reactivate"}
            </button>
            <button
              type="button"
              className={account.danger}
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Remove ${member.name || member.email}? They lose access to every workspace and base here.`)) remove.mutate();
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {status.isError ? <div className={account.error}>{errorText(status.error)}</div> : null}
      {remove.isError ? <div className={account.error}>{errorText(remove.error)}</div> : null}
      {setRole.isError ? <div className={account.error}>{errorText(setRole.error)}</div> : null}
      {transfer.isError ? <div className={account.error}>{errorText(transfer.error)}</div> : null}
      {open ? (
        <>
          {selected.size ? (
            <BulkAccessBar orgId={orgId} member={member} data={data} selected={selected} onDone={() => setSelected(new Set())} />
          ) : (
            <p className={account.muted}>
              A workspace role opens every base in it. Change a base's own role to give it more or less, or pick "No access to this base".
              Tick several rows to change them together.
            </p>
          )}
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th />
                <th>Workspace / base</th>
                <th>Role</th>
                <th>Access until</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.workspaces.map((w) => {
                const wsRole = member.grants.find((g) => g.resourceId === w.id)?.role ?? null;
                const pick = (key: string) => (on: boolean) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    on ? next.add(key) : next.delete(key);
                    return next;
                  });
                return [
                  <AccessRow
                    key={w.id}
                    orgId={orgId}
                    member={member}
                    label={w.name}
                    indent={false}
                    scope={{ workspaceId: w.id }}
                    inherited={null}
                    selected={selected.has(`wsp:${w.id}`)}
                    onSelect={pick(`wsp:${w.id}`)}
                    manageable={w.manageable !== false}
                  />,
                  ...w.bases.map((b) => (
                    <AccessRow
                      key={b.id}
                      orgId={orgId}
                      member={member}
                      label={b.name}
                      indent
                      scope={{ baseId: b.id }}
                      inherited={wsRole}
                      selected={selected.has(`bas:${b.id}`)}
                      onSelect={pick(`bas:${b.id}`)}
                    />
                  )),
                ];
              })}
            </tbody>
          </table>
        </>
      ) : null}
    </li>
  );
}

function PeopleSection({ orgId, data }: { orgId: string; data: OrgAccess }) {
  const refresh = useInvalidateAccess(orgId);
  const revoke = useMutation({ mutationFn: (id: string) => accountApi.revokeInvitation(id), onSettled: refresh });
  const nameOf = (i: OrgAccess["invitations"][number]) => {
    const ws = data.workspaces.find((w) => w.id === i.workspaceId);
    if (ws) return `${ws.name} (workspace)`;
    const ids = i.baseIds?.length ? i.baseIds : i.baseId ? [i.baseId] : [];
    const names = ids.map((id) => data.workspaces.flatMap((w) => w.bases).find((b) => b.id === id)?.name).filter(Boolean);
    return names.length ? names.join(", ") : "—";
  };
  return (
    <>
      <Section
        title="Invite people"
        description={
          data.me?.role === "owner"
            ? "Owners and Admins invite people. Give them a role on a whole workspace or on selected bases; you can change it, set an end date or remove it at any time. Only Owners invite Admins and Owners."
            : "As an Admin you invite Members to the workspaces and bases where you are Creator, up to your own role there."
        }
      >
        <InviteForm orgId={orgId} data={data} />
        {data.invitations.length ? (
          <ul className={account.sessionList}>
            {data.invitations.map((i) => (
              <li key={i.id} className={account.sessionItem}>
                <div className={account.sessionText}>
                  <span className={account.sessionName}>{i.email}</span>
                  <span className={account.muted}>
                    {i.orgRole && i.orgRole !== "member" ? `${accountLabel(i.orgRole)} · ` : ""}
                    {i.workspaceId || i.baseId ? `invited as ${i.role} to ${nameOf(i)}` : "no workspace or base yet"} · link expires{" "}
                    {new Date(i.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <button type="button" className={account.secondary} onClick={() => revoke.mutate(i.id)} disabled={revoke.isPending}>
                  Cancel invite
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
      <Section
        title="Members"
        description="Account types: Owners have everything; Admins manage Members and open only what they're given; Members open only what they're given. A workspace role applies to every base in that workspace; a base role to that base only."
      >
        <ul className={styles.memberList}>
          {data.members.map((m) => (
            <MemberCard key={m.id} orgId={orgId} member={m} data={data} />
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ----------------------------------------------------------------- devices */

const HISTORY_TEXT: Record<DeviceLogMember["history"][number]["kind"], string> = {
  requested: "asked for access from",
  approved: "approved",
  revoked: "revoked / denied",
  forgotten: "forgot",
};

function DevicesSection({ orgId, data }: { orgId: string; data: OrgAccess }) {
  const refreshAccess = useInvalidateAccess(orgId);
  const qc = useQueryClient();
  const log = useQuery({ queryKey: ["admin", "device-log", orgId], queryFn: () => adminApi.deviceLog(orgId), enabled: !!orgId });
  const refresh = () => {
    refreshAccess();
    void qc.invalidateQueries({ queryKey: ["admin", "device-log", orgId] });
  };
  const update = useMutation({
    mutationFn: (v: { id: string; status?: "approved" | "revoked"; label?: string }) =>
      adminApi.updateDevice(orgId, v.id, { ...(v.status ? { status: v.status } : {}), ...(v.label !== undefined ? { label: v.label } : {}) }),
    onSettled: refresh,
  });
  const del = useMutation({ mutationFn: (id: string) => adminApi.deleteDevice(orgId, id), onSettled: refresh });
  const members = [...(log.data?.members ?? [])].sort((a, b) => {
    const wa = a.devices.some((d) => d.status === "pending") ? 0 : 1;
    const wb = b.devices.some((d) => d.status === "pending") ? 0 : 1;
    return wa - wb || (a.isOwner ? 1 : 0) - (b.isOwner ? 1 : 0) || (a.name || a.email).localeCompare(b.name || b.email);
  });

  /** Admins decide on Members' devices only; Owners on everyone's but their own. */
  const mayDecide = (personId: string) => data.members.find((x) => x.id === personId)?.canManage ?? data.me?.role === "owner";
  const deviceRow = (d: DeviceLogMember["devices"][number], manage = true) => (
    <li key={d.id} className={account.sessionItem} data-testid="device-row">
      <div className={account.sessionText}>
        <span className={account.sessionName}>
          {d.label}
          <span className={d.status === "approved" ? account.badgeOn : styles.badgeWarn}>
            {d.status === "pending" ? "Waiting for approval" : d.status === "approved" ? "Approved" : "Revoked"}
          </span>
        </span>
        <span className={account.muted}>
          {d.lastIp ?? "Unknown IP"} · first seen {fmt(d.firstSeenAt)} · last active {fmt(d.lastSeenAt)}
          {d.decidedAt ? ` · ${d.status === "approved" ? "approved" : "revoked"} ${fmt(d.decidedAt)}${d.decidedBy ? ` by ${d.decidedBy}` : ""}` : ""}
        </span>
      </div>
      {manage ? (
      <div className={account.actions}>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => {
            const label = window.prompt("Device name", d.label);
            if (label && label.trim()) update.mutate({ id: d.id, label: label.trim() });
          }}
        >
          Rename
        </button>
        {d.status !== "approved" ? (
          <button type="button" className={account.primary} onClick={() => update.mutate({ id: d.id, status: "approved" })} disabled={update.isPending}>
            Approve
          </button>
        ) : null}
        {d.status !== "revoked" ? (
          <button type="button" className={account.danger} onClick={() => update.mutate({ id: d.id, status: "revoked" })} disabled={update.isPending}>
            {d.status === "pending" ? "Deny" : "Revoke"}
          </button>
        ) : (
          <button type="button" className={account.secondary} onClick={() => del.mutate(d.id)} disabled={del.isPending}>
            Forget
          </button>
        )}
      </div>
      ) : null}
    </li>
  );

  return (
    <Section
      title="Devices"
      description={
        data.org.requireDeviceApproval
          ? "Grouped by person. Each person can only open your data from devices you approve; a new browser or computer shows up as “Waiting” the first time they sign in. Each group also lists their active and ended sign-in sessions and every approval and revocation."
          : "Device approval is turned off (see Security), so any signed-in device works. Revoked devices stay blocked."
      }
    >
      {log.isLoading ? <p className={account.muted}>Loading…</p> : null}
      {log.isError ? <div className={account.error}>{errorText(log.error)}</div> : null}
      <div className={styles.deviceGroups}>
        {members.map((m) => {
          const waiting = m.devices.filter((d) => d.status === "pending");
          const approved = m.devices.filter((d) => d.status === "approved");
          const revoked = m.devices.filter((d) => d.status === "revoked");
          const active = m.sessions.filter((x) => x.active);
          const ended = m.sessions.filter((x) => !x.active);
          return (
            <details key={m.id} className={styles.deviceGroup} open={waiting.length > 0} data-testid="device-group">
              <summary className={styles.deviceGroupHead}>
                <span className={account.sessionName}>
                  {m.name || m.email}
                  {m.isOwner ? <span className={account.badgeOn}>Owner</span> : null}
                  {m.status === "suspended" ? <span className={styles.badgeWarn}>Suspended</span> : null}
                </span>
                <span className={styles.deviceCounts}>
                  {waiting.length ? <span className={styles.badgeWarn}>{waiting.length} waiting</span> : null}
                  <span>
                    {approved.length} approved · {revoked.length} revoked · {active.length} active session{active.length === 1 ? "" : "s"}
                  </span>
                </span>
              </summary>
              <div className={styles.deviceGroupBody}>
                <span className={account.muted}>{m.email}</span>
                {m.isOwner ? <p className={account.muted}>Owners’ devices never need approval.</p> : null}
                {waiting.length ? (
                  <>
                    <h4 className={styles.deviceSub}>Waiting for approval ({waiting.length})</h4>
                    <ul className={account.sessionList}>{waiting.map((d) => deviceRow(d, mayDecide(m.id)))}</ul>
                  </>
                ) : null}
                {!m.isOwner ? (
                  <>
                    <h4 className={styles.deviceSub}>Approved devices ({approved.length})</h4>
                    {approved.length ? <ul className={account.sessionList}>{approved.map((d) => deviceRow(d, mayDecide(m.id)))}</ul> : <p className={account.muted}>None.</p>}
                    {revoked.length ? (
                      <>
                        <h4 className={styles.deviceSub}>Revoked or denied ({revoked.length})</h4>
                        <ul className={account.sessionList}>{revoked.map((d) => deviceRow(d, mayDecide(m.id)))}</ul>
                      </>
                    ) : null}
                  </>
                ) : null}
                <h4 className={styles.deviceSub}>Active sessions ({active.length})</h4>
                {active.length ? (
                  <ul className={styles.sessionLog}>
                    {active.map((x) => (
                      <li key={x.id} data-testid="session-active">
                        <strong>{x.label}</strong> · {x.ip ?? "Unknown IP"} · signed in {fmt(x.startedAt)} · last active {fmt(x.lastSeenAt)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={account.muted}>Not signed in anywhere right now.</p>
                )}
                <details className={styles.subDetails}>
                  <summary>Ended sessions ({ended.length})</summary>
                  <ul className={styles.sessionLog}>
                    {ended.map((x) => (
                      <li key={x.id} data-testid="session-ended">
                        <strong>{x.label}</strong> · {x.ip ?? "Unknown IP"} · {fmt(x.startedAt)} → {x.endedAt ? `signed out ${fmt(x.endedAt)}` : `expired (last active ${fmt(x.lastSeenAt)})`}
                      </li>
                    ))}
                  </ul>
                </details>
                <details className={styles.subDetails} open={m.history.some((h) => h.kind !== "requested")}>
                  <summary>Approvals and revocations ({m.history.length})</summary>
                  <ul className={styles.sessionLog}>
                    {m.history.map((h, i) => (
                      <li key={`${h.at}-${i}`} data-testid="device-history" data-kind={h.kind}>
                        {fmt(h.at)} · {h.kind === "requested" ? (m.name || m.email) : (h.by ?? "Owner")} {HISTORY_TEXT[h.kind]} <strong>{h.deviceLabel}</strong>
                        {h.ip ? ` (${h.ip})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </details>
          );
        })}
      </div>
      {update.isError ? <div className={account.error}>{errorText(update.error)}</div> : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ tokens */

const SCOPES: { value: TokenScope; label: string; hint: string }[] = [
  { value: "read", label: "Read", hint: "List, query and fetch records; read base and table info" },
  { value: "write", label: "Write", hint: "Create and update records, set links" },
  { value: "delete", label: "Delete", hint: "Delete records" },
];

function TokensSection({ orgId, data }: { orgId: string; data: OrgAccess }) {
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: ["admin", "tokens", orgId], queryFn: () => adminApi.tokens(orgId) });
  const allBases = data.workspaces.flatMap((w) => w.bases.map((b) => ({ ...b, workspace: w.name })));
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<TokenScope>>(new Set(["read"]));
  const [allBasesOn, setAllBasesOn] = useState(true);
  const [bases, setBases] = useState<Set<string>>(new Set());
  const [days, setDays] = useState("90");
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      adminApi.createToken(orgId, {
        name: name.trim(),
        scopes: [...scopes],
        baseIds: allBasesOn ? null : [...bases],
        expiresAt: days === "never" ? null : new Date(Date.now() + Number(days) * 86400_000).toISOString(),
      }),
    onSuccess: (res) => {
      setCreated(res.token);
      setName("");
      void qc.invalidateQueries({ queryKey: ["admin", "tokens", orgId] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeToken(orgId, id),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["admin", "tokens", orgId] }),
  });
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  const baseName = (id: string) => allBases.find((b) => b.id === id)?.name ?? id;
  const describe = (t: ApiTokenInfo) =>
    `${data.me?.role === "owner" && t.createdBy ? `by ${t.createdBy} · ` : ""}${t.scopes.join(" + ")} · ${t.baseIds ? t.baseIds.map(baseName).join(", ") : "all bases"} · ${t.expiresAt ? `expires ${new Date(t.expiresAt).toLocaleDateString()}` : "never expires"} · last used ${t.lastUsedAt ? fmt(t.lastUsedAt) : "never"}`;
  return (
    <>
      <Section
        title="Create an API token"
        description={
          <>
            Tokens let your own scripts and tools use the record API with your permissions. Choose what the token may do and which bases it can reach.
            See the <a href="/help/api">API reference</a> for endpoints and examples.
          </>
        }
      >
        <form
          className={account.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && scopes.size && (allBasesOn || bases.size)) create.mutate();
          }}
        >
          <label className={account.label}>
            Name
            <input className={account.input} placeholder="e.g. Website sync" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Token type</legend>
            {SCOPES.map((s) => (
              <label key={s.value} className={styles.check}>
                <input type="checkbox" checked={scopes.has(s.value)} onChange={() => setScopes((v) => toggle(v, s.value))} />
                <span>
                  <strong>{s.label}</strong> <span className={account.muted}>— {s.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Bases</legend>
            <label className={styles.check}>
              <input type="radio" checked={allBasesOn} onChange={() => setAllBasesOn(true)} /> All bases, including future ones
            </label>
            <label className={styles.check}>
              <input type="radio" checked={!allBasesOn} onChange={() => setAllBasesOn(false)} /> Only these bases:
            </label>
            {!allBasesOn ? (
              <div className={styles.baseChecks}>
                {allBases.map((b) => (
                  <label key={b.id} className={styles.check}>
                    <input type="checkbox" checked={bases.has(b.id)} onChange={() => setBases((v) => toggle(v, b.id))} />
                    {b.name} <span className={account.muted}>({b.workspace})</span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
          <label className={account.label}>
            Expires
            <select className={account.input} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In 1 year</option>
              <option value="never">Never</option>
            </select>
          </label>
          <div className={account.actions}>
            <button type="submit" className={account.primary} disabled={create.isPending || !name.trim() || !scopes.size || (!allBasesOn && !bases.size)}>
              {create.isPending ? "Creating…" : "Create token"}
            </button>
          </div>
          {create.isError ? <div className={account.error}>{errorText(create.error)}</div> : null}
        </form>
        {created ? (
          <div className={account.ok} role="status">
            Copy your token now. For security it won’t be shown again.
            <div className={styles.tokenBox}>
              <code className={account.code}>{created}</code>
              <button type="button" className={account.secondary} onClick={() => void copyText(created)}>
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </Section>
      <Section title="Tokens">
        {tokens.isLoading ? <p className={account.muted}>Loading…</p> : null}
        {tokens.data?.tokens.length === 0 ? <p className={account.muted}>No tokens yet.</p> : null}
        <ul className={account.sessionList}>
          {tokens.data?.tokens.map((t) => (
            <li key={t.id} className={account.sessionItem}>
              <div className={account.sessionText}>
                <span className={account.sessionName}>
                  {t.name} <code className={account.code}>{t.prefix}…</code>
                  <span className={t.status === "active" ? account.badgeOn : styles.badgeWarn}>{t.status}</span>
                </span>
                <span className={account.muted}>{describe(t)}</span>
              </div>
              {t.status === "active" ? (
                <button
                  type="button"
                  className={account.danger}
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (window.confirm(`Revoke “${t.name}”? Anything using it stops working immediately.`)) revoke.mutate(t.id);
                  }}
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------------------------------------------------------------- settings */

function SettingsSection({ orgId, data }: { orgId: string; data: OrgAccess }) {
  const refresh = useInvalidateAccess(orgId);
  const save = useMutation({
    mutationFn: (v: boolean) => adminApi.setSettings(orgId, { requireDeviceApproval: v }),
    onSettled: refresh,
  });
  const domains = data.org.allowedSignupDomains ?? [];
  const [newDomain, setNewDomain] = useState("");
  const saveDomains = useMutation({
    mutationFn: (list: string[]) => adminApi.setSettings(orgId, { allowedSignupDomains: list }),
    onSuccess: () => setNewDomain(""),
    onSettled: refresh,
  });
  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (d && !domains.includes(d)) saveDomains.mutate([...domains, d]);
  };
  return (
    <Section title="Security" description="These rules apply to everyone except the Owners.">
      <div className={styles.signupDomains}>
        <strong>Allowed sign-up domains</strong>
        <span className={account.muted}>
          Anyone can create an account with an email address at these domains. They join this organization
          as a Member with no access until you give them a workspace or base, and you get a notification. Everyone
          else needs an invitation.
        </span>
        <div className={styles.domainChips}>
          {domains.length === 0 ? <span className={account.muted}>No domains: accounts by invitation only.</span> : null}
          {domains.map((d) => (
            <span key={d} className={styles.domainChip}>
              @{d}
              <button
                type="button"
                aria-label={`Remove @${d}`}
                disabled={saveDomains.isPending}
                onClick={() => saveDomains.mutate(domains.filter((x) => x !== d))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          className={styles.domainAdd}
          onSubmit={(e) => {
            e.preventDefault();
            addDomain();
          }}
        >
          <input
            className={account.input}
            placeholder="company.com"
            value={newDomain}
            aria-label="Email domain"
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <button type="submit" className={account.secondary} disabled={!newDomain.trim() || saveDomains.isPending}>
            Add domain
          </button>
        </form>
        {saveDomains.isError ? <div className={account.error}>{errorText(saveDomains.error)}</div> : null}
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={data.org.requireDeviceApproval} disabled={save.isPending} onChange={(e) => save.mutate(e.target.checked)} />
        <span>
          <strong>Require device approval</strong>
          <span className={account.muted}>
            {" "}
            — people can only use approved computers and browsers. This replaces MAC-address allowlists: web browsers can’t read a MAC address, so TableOS gives each browser its own private device key that you approve.
          </span>
        </span>
      </label>
      {save.isError ? <div className={account.error}>{errorText(save.error)}</div> : null}
    </Section>
  );
}

/* -------------------------------------------------------------------- page */

export function AdminPage({ tab, onTab, onBack }: { tab: AdminTab; onTab: (t: AdminTab) => void; onBack: () => void }) {
  const orgs = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => adminApi.orgs() });
  const owned = orgs.data?.orgs.filter((o) => o.canManage ?? o.isOwner) ?? [];
  const [orgId, setOrgId] = useState<string>("");
  useEffect(() => {
    if (!orgId && owned[0]) setOrgId(owned[0].id);
  }, [orgId, owned]);
  const access = useAccess(orgId);
  const data = orgId ? access.data : undefined;
  const tabs: { id: AdminTab; label: string; count?: number }[] = [
    { id: "people", label: "People" },
    { id: "devices", label: "Devices", ...(data?.pendingDevices ? { count: data.pendingDevices } : {}) },
    { id: "tokens", label: "API tokens" },
    { id: "settings", label: "Security" },
  ];
  return (
    <div className={account.page}>
      <header className={account.header}>
        <button type="button" className={account.back} onClick={onBack}>
          ← Back
        </button>
        <h1 className={account.title}>Members &amp; access</h1>
        {owned.length > 1 ? (
          <select className={`${account.input} ${styles.compact}`} value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Organization">
            {owned.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : null}
      </header>
      <main className={`${account.main} ${styles.wide}`}>
        {orgs.isLoading ? <p className={account.muted}>Loading…</p> : null}
        {orgs.data && owned.length === 0 ? (
          <div className={account.section}>
            <h2 className={account.sectionTitle}>Only Owners and Admins can manage access</h2>
            <p className={account.muted}>Ask an Owner or Admin of your organization to invite people, change roles or approve devices.</p>
          </div>
        ) : null}
        {data ? (
          <>
            <nav className={styles.tabs} role="tablist">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? styles.tabOn : styles.tab} onClick={() => onTab(t.id)}>
                  {t.label}
                  {t.count ? <span className={styles.count}>{t.count}</span> : null}
                </button>
              ))}
            </nav>
            {tab === "people" ? <PeopleSection orgId={orgId} data={data} /> : null}
            {tab === "devices" ? <DevicesSection orgId={orgId} data={data} /> : null}
            {tab === "tokens" ? <TokensSection orgId={orgId} data={data} /> : null}
            {tab === "settings" ? <SettingsSection orgId={orgId} data={data} /> : null}
          </>
        ) : null}
        {access.isError ? <div className={account.error}>{errorText(access.error)}</div> : null}
      </main>
    </div>
  );
}
