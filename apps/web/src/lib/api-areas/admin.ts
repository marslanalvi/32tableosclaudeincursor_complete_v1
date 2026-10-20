import { request } from "../api.ts";

/** Access administration for Owners and Admins: members, account types, roles, devices, API tokens. */

export type GrantRole = "creator" | "editor" | "commenter" | "viewer";
/** On a workspace only: workspace Owner. */
export type WorkspaceGrantRole = GrantRole | "owner";
export type OrgRole = "owner" | "admin" | "member";
/** On a base only: block it although the workspace role would open it. */
export type BaseGrantRole = GrantRole | "none";
export type TokenScope = "read" | "write" | "delete";

export interface OrgSummary {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  /** Owner or Admin: may open Members & access. */
  canManage?: boolean;
}

export interface MemberGrant {
  resourceType: "workspace" | "base";
  resourceId: string;
  role: string;
  expiresAt: string | null;
  expired: boolean;
}

export interface MemberDevice {
  id: string;
  label: string;
  userAgent: string | null;
  lastIp: string | null;
  status: "pending" | "approved" | "revoked";
  firstSeenAt: string;
  lastSeenAt: string;
  decidedAt: string | null;
}

export interface OrgMember {
  id: string;
  email: string;
  name: string;
  orgRole: string;
  isOwner: boolean;
  isMe?: boolean;
  /** Whether I may change this person's access, suspend or remove them. */
  canManage?: boolean;
  status: "active" | "suspended";
  joinedAt: string | null;
  grants: MemberGrant[];
  devices: MemberDevice[];
}

export interface OrgAccess {
  org: { id: string; name: string; requireDeviceApproval: boolean; allowedSignupDomains?: string[] };
  me?: { id: string; role: OrgRole };
  /** manageable = false: an Admin may manage some bases here, not the whole workspace. */
  workspaces: { id: string; name: string; manageable?: boolean; bases: { id: string; name: string }[] }[];
  members: OrgMember[];
  invitations: { id: string; email: string; role: string; orgRole?: string; workspaceId: string | null; baseId: string | null; baseIds?: string[]; expiresAt: string }[];
  pendingDevices: number;
}

export interface ApiTokenInfo {
  id: string;
  name: string;
  createdBy?: string | null;
  prefix: string;
  scopes: TokenScope[];
  baseIds: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  status: "active" | "revoked" | "expired";
  createdAt: string;
}

/** Devices log for one person (Members & access → Devices). */
export interface DeviceLogMember {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  status: "active" | "suspended";
  devices: (MemberDevice & { firstIp: string | null; decidedBy: string | null })[];
  sessions: { id: string; label: string; ip: string | null; startedAt: string; lastSeenAt: string; endedAt: string | null; active: boolean }[];
  history: { kind: "requested" | "approved" | "revoked" | "forgotten"; at: string; deviceId: string | null; deviceLabel: string; by: string | null; ip: string | null }[];
}

/** One row of Members & access → Activity (audit log). */
export interface ActivityEvent {
  id: string;
  action: string;
  at: string;
  actor: { name: string; email: string } | null;
  targetType: string | null;
  target: string | null;
  details: Record<string, unknown>;
  ip: string | null;
}

export interface PendingDevice {
  orgId: string;
  orgName: string;
  status: "pending" | "revoked";
  label: string;
  ownerName: string | null;
}

const org = (id: string) => `/v1/orgs/${encodeURIComponent(id)}`;

export const adminApi = {
  orgs() {
    return request<{ orgs: OrgSummary[] }>("/v1/orgs");
  },
  currentDevice() {
    return request<{ pending: PendingDevice[] }>("/v1/devices/current");
  },
  access(orgId: string) {
    return request<OrgAccess>(`${org(orgId)}/access`);
  },
  setSettings(orgId: string, body: { requireDeviceApproval?: boolean; allowedSignupDomains?: string[] }) {
    return request<{ requireDeviceApproval: boolean; allowedSignupDomains: string[] }>(`${org(orgId)}/settings`, { method: "PATCH", json: body });
  },
  setGrant(
    orgId: string,
    userId: string,
    body: { workspaceId?: string; baseId?: string; role: BaseGrantRole | WorkspaceGrantRole | null; expiresAt?: string | null },
  ) {
    return request<{ ok: true }>(`${org(orgId)}/members/${encodeURIComponent(userId)}/grants`, { method: "PUT", json: body });
  },
  setMemberStatus(orgId: string, userId: string, status: "active" | "suspended") {
    return request<{ status: string }>(`${org(orgId)}/members/${encodeURIComponent(userId)}`, { method: "PATCH", json: { status } });
  },
  setOrgRole(orgId: string, userId: string, role: OrgRole) {
    return request<{ role: OrgRole }>(`${org(orgId)}/members/${encodeURIComponent(userId)}/role`, { method: "PUT", json: { role } });
  },
  transferOwnership(orgId: string, userId: string) {
    return request<{ ok: true }>(`${org(orgId)}/transfer-ownership`, { method: "POST", json: { userId } });
  },
  removeMember(orgId: string, userId: string) {
    return request<void>(`${org(orgId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
  },
  deviceLog(orgId: string) {
    return request<{ members: DeviceLogMember[] }>(`${org(orgId)}/device-log`);
  },
  updateDevice(orgId: string, deviceId: string, body: { status?: "approved" | "revoked"; label?: string }) {
    return request<{ status: string }>(`${org(orgId)}/devices/${encodeURIComponent(deviceId)}`, { method: "PATCH", json: body });
  },
  deleteDevice(orgId: string, deviceId: string) {
    return request<void>(`${org(orgId)}/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
  },
  activity(orgId: string, q: { before?: string | null; category?: string }) {
    const qs = new URLSearchParams();
    if (q.before) qs.set("before", q.before);
    if (q.category) qs.set("category", q.category);
    return request<{ events: ActivityEvent[]; nextBefore: string | null }>(`${org(orgId)}/activity?${qs.toString()}`);
  },
  tokens(orgId: string) {
    return request<{ tokens: ApiTokenInfo[] }>(`${org(orgId)}/api-tokens`);
  },
  createToken(orgId: string, body: { name: string; scopes: TokenScope[]; baseIds?: string[] | null; expiresAt?: string | null }) {
    return request<{ token: string; apiToken: ApiTokenInfo }>(`${org(orgId)}/api-tokens`, { method: "POST", json: body });
  },
  revokeToken(orgId: string, tokenId: string) {
    return request<void>(`${org(orgId)}/api-tokens/${encodeURIComponent(tokenId)}`, { method: "DELETE" });
  },
};
