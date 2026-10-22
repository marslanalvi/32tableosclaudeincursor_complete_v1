import type { TableOSDb } from "@tableos/db";
import type { BaseRole, WorkspaceRole } from "@tableos/permissions";
import { compileForUser } from "./compile.js";
import { BASE_ROLE_RANK, WORKSPACE_ROLE_RANK, getWorkspaceAccess, type OrgRole } from "./workspace-access.js";

/**
 * How far an Owner or Admin may hand out access on one workspace or base (questionnaire B3:
 * Admins only reach what they've been given). Owners: anything. Admins: only where they are
 * Creator or workspace Owner themselves, and never above their own role there. Returns the
 * highest rank they may give (on the scale of that resource), 0 = may not manage access there.
 */
export async function grantCeiling(
  db: TableOSDb,
  actorId: string,
  actorRole: OrgRole | null,
  target: { workspaceId: string } | { baseId: string },
): Promise<number> {
  if (actorRole === "owner") return Number.POSITIVE_INFINITY;
  if (actorRole !== "admin") return 0;
  if ("workspaceId" in target) {
    const access = await getWorkspaceAccess(db, actorId, target.workspaceId);
    const rank = access?.workspaceRole ? WORKSPACE_ROLE_RANK[access.workspaceRole as WorkspaceRole] : 0;
    return rank >= WORKSPACE_ROLE_RANK.creator ? rank : 0;
  }
  const snap = await compileForUser(db, actorId, target.baseId);
  const rank = snap.effectiveBaseRole ? (BASE_ROLE_RANK[snap.effectiveBaseRole as BaseRole] ?? 0) : 0;
  return rank >= BASE_ROLE_RANK.creator ? rank : 0;
}

/** Rank of a role on that resource's scale; "none"/null (blocking or removing) count as 0. */
export function roleRank(kind: "workspace" | "base", role: string | null | undefined): number {
  if (!role || role === "none") return 0;
  return kind === "workspace"
    ? (WORKSPACE_ROLE_RANK[role as WorkspaceRole] ?? 0)
    : (BASE_ROLE_RANK[role as BaseRole] ?? 0);
}
