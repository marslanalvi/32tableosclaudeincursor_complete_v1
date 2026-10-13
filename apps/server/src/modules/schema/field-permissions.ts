/**
 * Field permissions ("Who can edit values in this field?"), stored in data.fields.edit_permission.
 * NULL means the default: anyone who can edit records (editors and up).
 */
import { ApiError } from "../../http/errors.js";
import { pid } from "../../lib/public-ids.js";

export const FIELD_EDIT_LEVELS = ["editors", "creators", "specific", "nobody"] as const;
export type FieldEditLevel = (typeof FIELD_EDIT_LEVELS)[number];

export interface FieldEditPermission {
  level: Exclude<FieldEditLevel, "editors">;
  /** Raw user uuids; only used with level "specific". */
  userIds: string[];
}

export function parseEditPermission(raw: unknown): FieldEditPermission | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { level?: unknown; userIds?: unknown };
  if (r.level !== "creators" && r.level !== "specific" && r.level !== "nobody") return null;
  const userIds = Array.isArray(r.userIds) ? r.userIds.filter((u): u is string => typeof u === "string") : [];
  return { level: r.level, userIds: r.level === "specific" ? userIds : [] };
}

export function editPermissionToWire(p: FieldEditPermission | null): { level: FieldEditLevel; userIds: string[] } {
  if (!p) return { level: "editors", userIds: [] };
  return { level: p.level, userIds: p.userIds.map((u) => pid("usr", u)) };
}

/** Whether a user with `role` may write values into a field with permission `p`. */
export function canEditFieldValues(p: FieldEditPermission | null, role: string | null, userId: string | null): boolean {
  const editor = role === "owner" || role === "creator" || role === "editor";
  if (!editor) return false;
  if (!p) return true;
  if (p.level === "nobody") return false;
  if (p.level === "creators") return role === "owner" || role === "creator";
  return userId !== null && p.userIds.includes(userId);
}

export function fieldPermissionDenied(fieldName: string, fieldId: string): ApiError {
  return new ApiError(403, "FIELD_PERMISSION_DENIED", `You don't have permission to edit values in "${fieldName}"`, {
    field: pid("fld", fieldId),
  });
}
