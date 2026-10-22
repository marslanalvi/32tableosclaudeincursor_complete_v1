import { randomBytes } from "node:crypto";

/**
 * Marks requests this process forwards to itself (app.inject), so per-request work such as the
 * API-token rate limit runs once. Random per process: callers can't forge it.
 */
export const INTERNAL_RELAY_HEADER = "x-tableos-relay";
export const INTERNAL_RELAY_SECRET = randomBytes(24).toString("base64url");

export function isInternalRelay(headers: Record<string, unknown>): boolean {
  return headers[INTERNAL_RELAY_HEADER] === INTERNAL_RELAY_SECRET;
}
