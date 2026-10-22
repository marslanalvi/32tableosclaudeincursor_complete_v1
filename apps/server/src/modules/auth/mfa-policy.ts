import type { TableOSDb } from "@tableos/db";
import { sql } from "kysely";

/**
 * Two-factor sign-in is required for everyone (questionnaire B9): a signed-in person without
 * two-factor can only reach their account and the two-factor setup until they turn it on.
 * Platform switch `core.platform_settings.require_mfa` (migration 0083).
 */
const CACHE_MS = 5_000;
let cached: { value: boolean; at: number } | null = null;

export async function mfaRequired(db: TableOSDb): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const r = await sql<{ value: unknown }>`SELECT value FROM core.platform_settings WHERE key = 'require_mfa'`
    .execute(db)
    .catch(() => ({ rows: [] as { value: unknown }[] }));
  const value = r.rows[0]?.value !== false;
  cached = { value, at: Date.now() };
  return value;
}

/** What someone who still has to set up two-factor may call (not the realtime ticket: live data). */
export function allowedBeforeMfa(path: string): boolean {
  return (
    (path.startsWith("/v1/auth/") && path !== "/v1/auth/ws-ticket") ||
    path === "/v1/invitations/accept" ||
    path === "/v1/devices/current" ||
    path === "/v1/version"
  );
}
