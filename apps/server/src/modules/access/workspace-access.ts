import type { TableOSDb } from "@tableos/db";
import {
  maxWorkspaceRole,
  type BaseRole,
  type WorkspaceRole,
} from "@tableos/permissions";
import { sql } from "kysely";
import { requestMayAccess } from "../../kernel/request-context.js";

/** The three account types (questionnaire B14). */
export type OrgRole = "owner" | "admin" | "member";
export const ORG_ROLES: readonly OrgRole[] = ["owner", "admin", "member"];

export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 50,
  creator: 40,
  editor: 30,
  commenter: 20,
  viewer: 10,
};

export const BASE_ROLE_RANK: Record<BaseRole, number> = {
  creator: 40,
  editor: 30,
  commenter: 20,
  viewer: 10,
  interface_only: 5,
};

/**
 * Owners open every workspace in their org. Admins only get the workspaces and bases they've
 * been given (questionnaire B3).
 */
export function orgRoleGrantsWorkspaceOwner(role: string | null | undefined): boolean {
  return role === "owner";
}

export interface WorkspaceAccess {
  orgId: string;
  orgRole: OrgRole;
  /** Effective workspace role (explicit grant, or `owner` for org owners). Null = no workspace access. */
  workspaceRole: WorkspaceRole | null;
}

/**
 * Resolve a user's effective role on a workspace. Org membership alone does
 * NOT grant workspace access: the user needs a workspace grant, or must be an
 * org owner/admin.
 */
export async function getWorkspaceAccess(
  db: TableOSDb,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceAccess | null> {
  const res = await sql<{ org_id: string; org_role: string; grant_role: string | null }>`
    SELECT w.org_id, m.role AS org_role,
           (SELECT g.role FROM core.access_grants g
             WHERE g.principal_type = 'user' AND g.principal_id = ${userId}
               AND g.resource_type = 'workspace' AND g.resource_id = w.id
               AND (g.expires_at IS NULL OR g.expires_at > now())
             ORDER BY CASE g.role WHEN 'owner' THEN 5 WHEN 'creator' THEN 4 WHEN 'editor' THEN 3
                                  WHEN 'commenter' THEN 2 ELSE 1 END DESC
             LIMIT 1) AS grant_role
    FROM core.workspaces w
    INNER JOIN core.organization_members m
      ON m.org_id = w.org_id AND m.user_id = ${userId} AND m.status = 'active'
    WHERE w.id = ${workspaceId} AND w.deleted_at IS NULL AND w.status = 'active'
    LIMIT 1
  `.execute(db);
  const row = res.rows[0];
  if (!row || !requestMayAccess(row.org_id)) return null;
  let role: WorkspaceRole | null = (row.grant_role as WorkspaceRole | null) ?? null;
  if (orgRoleGrantsWorkspaceOwner(row.org_role)) {
    role = role ? maxWorkspaceRole(role, "owner") : "owner";
  }
  return { orgId: row.org_id, orgRole: row.org_role as OrgRole, workspaceRole: role };
}

/** Org role of the user, or null when not an active member. */
export async function getOrgRole(
  db: TableOSDb,
  userId: string,
  orgId: string,
): Promise<OrgRole | null> {
  const res = await sql<{ role: string }>`
    SELECT role FROM core.organization_members
    WHERE org_id = ${orgId} AND user_id = ${userId} AND status = 'active'
    LIMIT 1
  `.execute(db);
  return (res.rows[0]?.role as OrgRole | undefined) ?? null;
}

/** Owners only: create Admins and Owners, transfer ownership. */
export async function isOrgOwner(db: TableOSDb, userId: string, orgId: string): Promise<boolean> {
  return requestMayAccess(orgId) && (await getOrgRole(db, userId, orgId)) === "owner";
}

/** Owners and Admins run the organization: workspaces, bases, export, duplicating bases. */
export function isOrgManagerRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export async function isOrgManager(db: TableOSDb, userId: string, orgId: string): Promise<boolean> {
  return requestMayAccess(orgId) && isOrgManagerRole(await getOrgRole(db, userId, orgId));
}

/**
 * Whether someone with org role `actor` may manage a person with org role `target`:
 * Owners manage everyone, Admins manage Members only, nobody manages their own access.
 */
export function canManageMember(actor: OrgRole | null, target: string, self: boolean): boolean {
  if (self || !actor) return false;
  if (actor === "owner") return true;
  return actor === "admin" && target === "member";
}

/** Workspace roles can manage members when they are owner or creator. */
export function workspaceRoleCanManageMembers(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "creator";
}
