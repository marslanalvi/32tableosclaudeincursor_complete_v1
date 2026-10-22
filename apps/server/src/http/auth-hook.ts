import {
  SESSION_COOKIE_NAME,
  hashSessionToken,
} from "@tableos/auth";
import { sql } from "kysely";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../lib/app-context.js";
import { currentRequestContext } from "../kernel/request-context.js";
import { blockedOrgsForDevice, ensureDeviceKey } from "../modules/access/devices.js";
import { API_TOKEN_PREFIX, TOKEN_ROUTES_HINT, normalizeApiPath, requiredScope, resolveApiToken, tokenRateLimit } from "../modules/access/api-tokens.js";
import { isInternalRelay } from "../lib/internal-relay.js";
import { SESSION_IDLE_DAYS, setSessionCookie } from "../modules/auth/session.js";
import { allowedBeforeMfa, mfaRequired } from "../modules/auth/mfa-policy.js";
import { sendApiError, unauthorized } from "./errors.js";

export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  /** Empty for API-token requests. */
  sessionId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: RequestUser;
    /** Set when the request authenticated with an API token instead of a session. */
    apiTokenId?: string;
  }
}

const PUBLIC_PREFIXES = [
  "/health",
  "/v1/version",
  "/v1/openapi.json",
  "/v1/auth/signup",
  "/v1/auth/login",
  "/v1/auth/google",
  "/v1/auth/google/callback",
  // Identified by the single-use OAuth state, which is bound to the user who started it.
  "/v1/connections/gmail/callback",
  "/v1/auth/mfa/verify",
  "/v1/auth/logout",
];

export function isPublicRoute(url: string, method?: string): boolean {
  const path = url.split("?")[0] ?? url;
  if (path.startsWith("/v1/public/") || path.startsWith("/v1/hooks/")) {
    return true;
  }
  if (method === "PUT" && path.startsWith("/v1/uploads/")) {
    return true;
  }
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}?`));
}

/** IANA zone from the `X-Time-Zone` header, if it is one this runtime knows. */
function browserTimeZone(request: FastifyRequest): string | null {
  const h = request.headers["x-time-zone"];
  if (typeof h !== "string" || h.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(h)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: h });
    return h;
  } catch {
    return null;
  }
}

/** `Bearer tos_…`; also a bare or quoted `tos_…`, which Postman and copy-paste often produce. */
function bearerToken(request: FastifyRequest): string | null {
  const h = request.headers.authorization;
  if (typeof h !== "string") return null;
  const m = /^(?:Bearer\s+)?["']?(\S+?)["']?$/i.exec(h.trim());
  const token = m?.[1] ?? null;
  if (!token) return null;
  return /^Bearer\s/i.test(h.trim()) || token.startsWith(API_TOKEN_PREFIX) ? token : null;
}

export async function authHook(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = normalizeApiPath(request.url);
  const bearer = bearerToken(request);
  // Browsers get a device key before signing in so the login itself is tied to a device.
  const deviceKey = bearer ? null : ensureDeviceKey(request, reply, ctx.env);
  if (isPublicRoute(path, request.method)) {
    return;
  }

  if (bearer) {
    try {
      const token = await resolveApiToken(ctx.db, bearer, request.ip ?? null);
      if (!token) {
        unauthorized(request, reply, "This API token is invalid, revoked or expired, or the person who made it is no longer an Owner or Admin");
        return;
      }
      const scope = requiredScope(request.method, path);
      if (!scope) {
        sendApiError(
          request,
          reply,
          403,
          "FORBIDDEN",
          `API tokens can only call the record API, not ${request.method} ${path}. ${TOKEN_ROUTES_HINT}`,
        );
        return;
      }
      if (!token.scopes.includes(scope)) {
        sendApiError(request, reply, 403, "FORBIDDEN", `This token doesn't have the "${scope}" permission`);
        return;
      }
      if (!isInternalRelay(request.headers)) {
        const rate = await tokenRateLimit(ctx, token);
        if (rate.retryAfterSec > 0) {
          void reply.header("retry-after", String(rate.retryAfterSec));
          sendApiError(request, reply, 429, "RATE_LIMITED", `This token can make ${rate.limit} requests per second on your plan. Wait a moment and retry.`, {
            limitPerSecond: rate.limit,
            retryAfterSec: rate.retryAfterSec,
          });
          return;
        }
      }
      request.user = { id: token.userId, email: token.email, displayName: token.displayName, sessionId: "" };
      request.apiTokenId = token.id;
      const store = currentRequestContext();
      if (store) {
        store.access = {
          blockedOrgs: new Set(),
          token: {
            id: token.id,
            orgId: token.orgId,
            scopes: new Set(token.scopes),
            baseIds: token.baseIds ? new Set(token.baseIds) : null,
          },
        };
      }
    } catch (err) {
      request.log.error({ err }, "api token lookup failed");
      authUnavailable(request, reply);
    }
    return;
  }

  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    const triedApiKey = request.headers.authorization !== undefined || request.headers["x-api-key"] !== undefined;
    unauthorized(request, reply, triedApiKey ? "Send your API token in the Authorization header as: Bearer tos_…" : undefined);
    return;
  }

  const tokenHash = hashSessionToken(token);
  try {
    const result = await sql<{
      session_id: string;
      user_id: string;
      email: string;
      display_name: string;
      auth_method: string;
      time_zone: string | null;
      cookie_stale: boolean;
      seen_stale: boolean;
      has_mfa: boolean;
    }>`
      SELECT s.id AS session_id, u.id AS user_id, u.email, u.display_name, s.auth_method, u.time_zone,
             EXISTS (SELECT 1 FROM core.user_mfa_factors f WHERE f.user_id = u.id AND f.confirmed_at IS NOT NULL) AS has_mfa,
             (s.cookie_refreshed_at IS NULL OR s.cookie_refreshed_at < now() - interval '1 day') AS cookie_stale,
             (s.last_seen_at IS NULL OR s.last_seen_at < now() - interval '1 minute') AS seen_stale
      FROM core.sessions s
      INNER JOIN core.users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND s.idle_expires_at > now()
        AND u.status = 'active'
      LIMIT 1
    `.execute(ctx.db);

    const row = result.rows[0];
    if (!row) {
      unauthorized(request, reply);
      return;
    }

    // Activity pushes the 30-day idle end out again (automation sessions keep their short life).
    const refreshCookie = row.cookie_stale && row.auth_method !== "automation";
    if (row.seen_stale || refreshCookie) {
      await sql`
        UPDATE core.sessions
        SET last_seen_at = now(),
            idle_expires_at = ${row.auth_method === "automation" ? sql`idle_expires_at` : sql`now() + make_interval(days => ${SESSION_IDLE_DAYS})`},
            cookie_refreshed_at = ${refreshCookie ? sql`now()` : sql`cookie_refreshed_at`}
        WHERE id = ${row.session_id}
      `.execute(ctx.db);
    }
    if (refreshCookie) setSessionCookie(reply, ctx.env, token);

    request.user = {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
      sessionId: row.session_id,
    };

    if (row.auth_method !== "automation" && !row.has_mfa && !allowedBeforeMfa(path) && (await mfaRequired(ctx.db))) {
      sendApiError(request, reply, 403, "MFA_SETUP_REQUIRED", "Set up two-factor sign-in to continue (Account → Two-factor authentication).");
      return;
    }

    // Date filters, "today" and chart day buckets use the viewer's own calendar.
    const tz = browserTimeZone(request);
    if (tz && tz !== row.time_zone && row.auth_method !== "automation") {
      await sql`UPDATE core.users SET time_zone = ${tz} WHERE id = ${row.user_id}`.execute(ctx.db);
    }

    // Automation runs use cookie-less service sessions and act for the automation owner.
    if (deviceKey && row.auth_method !== "automation") {
      const blockedOrgs = await blockedOrgsForDevice(ctx.db, row.user_id, deviceKey, {
        ip: request.ip ?? null,
        userAgent: request.headers["user-agent"] ?? null,
      });
      const store = currentRequestContext();
      if (store) store.access = { blockedOrgs };
    }
  } catch (err) {
    request.log.error({ err }, "auth session lookup failed");
    authUnavailable(request, reply);
  }
}

/** A failed lookup (database busy or down) is not a signed-out session; a 401 here would log the user out. */
function authUnavailable(request: FastifyRequest, reply: FastifyReply): void {
  reply.header("retry-after", "2");
  sendApiError(request, reply, 503, "SERVICE_UNAVAILABLE", "The server is busy. Please try again in a moment.");
}
