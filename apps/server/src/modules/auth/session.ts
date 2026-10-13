import {
  SESSION_COOKIE_NAME,
  generateSessionToken,
  hashSessionToken,
} from "@tabula/auth";
import { generateUuidV7 } from "@tabula/types";
import { sql } from "kysely";
import type { FastifyReply } from "fastify";
import type { TabulaDb } from "@tabula/db";
import type { Env } from "@tabula/config";

/**
 * Sessions don't expire: they last until sign-out or revocation. Browsers cap cookie
 * lifetimes at about 400 days, so the cookie is re-issued while the user is active.
 */
const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export interface CreateSessionOptions {
  authMethod?: "password" | "oauth";
  mfaLevel?: "none" | "mfa";
  ip?: string | null;
  userAgent?: string | null;
}

function cookieOptions(env: Env) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
  };
}

export async function createSession(
  db: TabulaDb,
  userId: string,
  reply: FastifyReply,
  env: Env,
  opts: CreateSessionOptions = {},
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const sessionId = generateUuidV7();

  await sql`
    INSERT INTO core.sessions (
      id, user_id, token_hash, auth_method, mfa_level, ip, user_agent,
      idle_expires_at, expires_at, cookie_refreshed_at
    ) VALUES (
      ${sessionId},
      ${userId},
      ${tokenHash},
      ${opts.authMethod ?? "password"},
      ${opts.mfaLevel ?? "none"},
      ${opts.ip ?? null}::inet,
      ${opts.userAgent?.slice(0, 500) ?? null},
      now() + interval '100 years',
      now() + interval '100 years',
      now()
    )
  `.execute(db);

  setSessionCookie(reply, env, token);
  return sessionId;
}

/** (Re)issue the session cookie with the longest lifetime browsers allow. */
export function setSessionCookie(reply: FastifyReply, env: Env, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(env),
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

/**
 * Mint a short-lived, cookie-less session for an automation run. The token is
 * used by the automation engine to call the public API as the automation owner.
 */
export async function createServiceSession(
  db: TabulaDb,
  userId: string,
  ttlMinutes = 15,
): Promise<{ sessionId: string; token: string }> {
  const token = generateSessionToken();
  const sessionId = generateUuidV7();
  await sql`
    INSERT INTO core.sessions (
      id, user_id, token_hash, auth_method, idle_expires_at, expires_at, user_agent
    ) VALUES (
      ${sessionId}, ${userId}, ${hashSessionToken(token)}, 'automation',
      now() + make_interval(mins => ${ttlMinutes}),
      now() + make_interval(mins => ${ttlMinutes}),
      'tabula-automation'
    )
  `.execute(db);
  return { sessionId, token };
}

export async function revokeSession(
  db: TabulaDb,
  sessionId: string,
): Promise<void> {
  await sql`
    UPDATE core.sessions SET revoked_at = now() WHERE id = ${sessionId} AND revoked_at IS NULL
  `.execute(db);
}

export async function revokeSessionByToken(db: TabulaDb, token: string): Promise<void> {
  await sql`
    UPDATE core.sessions SET revoked_at = now()
    WHERE token_hash = ${hashSessionToken(token)} AND revoked_at IS NULL
  `.execute(db);
}

export function clearSessionCookie(reply: FastifyReply, env: Env): void {
  reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions(env));
}
