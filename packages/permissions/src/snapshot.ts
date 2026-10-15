import type { BaseRole } from "./roles.js";
import { mapWorkspaceRoleToBase, maxBaseRole, type WorkspaceRole } from "./roles.js";

export interface AccessGrantRow {
  resource_type: "org" | "workspace" | "base" | "interface";
  resource_id: string;
  workspace_id?: string | null;
  base_id?: string | null;
  role: string;
}

export interface CompileSnapshotInput {
  baseId: string;
  workspaceId: string;
  grants: AccessGrantRow[];
}

export interface PermissionSnapshot {
  baseId: string;
  workspaceId: string;
  effectiveBaseRole: BaseRole | null;
  permEpoch: number;
}

/**
 * Compile effective base role from grant rows (workspace + base scoped).
 * @param grants — rows from `core.access_grants` for the principal
 */
export function compileSnapshot(
  input: CompileSnapshotInput,
  permEpoch?: number,
): PermissionSnapshot;
export function compileSnapshot(
  grants: AccessGrantRow[],
  context: Pick<CompileSnapshotInput, "baseId" | "workspaceId">,
  permEpoch?: number,
): PermissionSnapshot;
export function compileSnapshot(
  inputOrGrants: CompileSnapshotInput | AccessGrantRow[],
  permEpochOrContext?: number | Pick<CompileSnapshotInput, "baseId" | "workspaceId">,
  permEpoch = 1,
): PermissionSnapshot {
  const input: CompileSnapshotInput = Array.isArray(inputOrGrants)
    ? {
        baseId: (permEpochOrContext as Pick<CompileSnapshotInput, "baseId" | "workspaceId">)
          .baseId,
        workspaceId: (
          permEpochOrContext as Pick<CompileSnapshotInput, "baseId" | "workspaceId">
        ).workspaceId,
        grants: inputOrGrants,
      }
    : inputOrGrants;
  const epoch = Array.isArray(inputOrGrants)
    ? (typeof permEpochOrContext === "number" ? permEpochOrContext : permEpoch)
    : (permEpochOrContext as number | undefined) ?? 1;

  return compileSnapshotInner(input, epoch);
}

/** Base grant role that blocks a base the workspace role would otherwise open. */
export const NO_ACCESS_ROLE = "none";

/**
 * A base's own setting wins over the role inherited from its workspace (higher, lower, or
 * `none` = no access). Workspace owners always keep full access.
 */
export function combineBaseRole(baseRole: string | null, workspaceRole: string | null): BaseRole | null {
  if (workspaceRole === "owner") return "creator";
  if (baseRole) return baseRole === NO_ACCESS_ROLE ? null : (baseRole as BaseRole);
  return workspaceRole ? mapWorkspaceRoleToBase(workspaceRole as WorkspaceRole) : null;
}

const WORKSPACE_RANK: Record<string, number> = { owner: 5, creator: 4, editor: 3, commenter: 2, viewer: 1 };

function compileSnapshotInner(
  input: CompileSnapshotInput,
  permEpoch: number,
): PermissionSnapshot {
  let baseRole: string | null = null;
  let workspaceRole: string | null = null;

  for (const grant of input.grants) {
    if (grant.resource_type === "base" && grant.base_id === input.baseId) {
      if (grant.role === NO_ACCESS_ROLE) baseRole = baseRole ?? NO_ACCESS_ROLE;
      else baseRole = !baseRole || baseRole === NO_ACCESS_ROLE ? grant.role : maxBaseRole(baseRole as BaseRole, grant.role as BaseRole);
    }
    if (grant.resource_type === "workspace" && grant.workspace_id === input.workspaceId) {
      if (!workspaceRole || (WORKSPACE_RANK[grant.role] ?? 0) > (WORKSPACE_RANK[workspaceRole] ?? 0)) workspaceRole = grant.role;
    }
  }

  return {
    baseId: input.baseId,
    workspaceId: input.workspaceId,
    effectiveBaseRole: combineBaseRole(baseRole, workspaceRole),
    permEpoch,
  };
}

export { compileSnapshotInner as compileSnapshotFromInput };
