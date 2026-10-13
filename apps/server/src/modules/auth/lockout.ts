import { hashSessionToken, SESSION_COOKIE_NAME } from "@tabula/auth";
import type { TabulaDb } from "@tabula/db";
import type { FastifyRequest } from "fastify";
import { sql } from "kysely";
import { sendEmail } from "../automations/mailer.js";
import { createNotifications } from "../notifications/create.js";
import type { AuthRateLimiter } from "./rate-limit.js";

/**
 * Wrong-password policy (sign-in and password-protected shares):
 * attempts 1–2 fail quietly, 3–5 warn with the attempts left, the 5th locks
 * the account (or the share for that visitor) for {@link LOCK_MINUTES}.
 * Organization owners' own accounts are exempt. Every wrong attempt alerts
 * the owners in-app and by email with the email address and IP.
 */
export const MAX_ATTEMPTS = 5;
export const WARN_FROM = 3;
export const LOCK_MINUTES = 15;
const WINDOW_SEC = 15 * 60;
const LOCK_SEC = LOCK_MINUTES * 60;

export interface AttemptOutcome {
  attempt: number;
  remaining: number;
  locked: boolean;
  retryAfterSec: number;
}

export class PasswordLockout {
  constructor(private readonly limiter: AuthRateLimiter) {}

  async lockedFor(key: string): Promise<number> {
    const r = await this.limiter.peek(`pwlock:${key}`, 1);
    return r.allowed ? 0 : r.retryAfterSec;
  }

  async fail(key: string): Promise<AttemptOutcome> {
    const hit = await this.limiter.hit(`pwfail:${key}`, MAX_ATTEMPTS, WINDOW_SEC);
    if (hit.count >= MAX_ATTEMPTS) {
      await this.limiter.hit(`pwlock:${key}`, 1, LOCK_SEC);
      await this.limiter.reset(`pwfail:${key}`);
      return { attempt: hit.count, remaining: 0, locked: true, retryAfterSec: LOCK_SEC };
    }
    return { attempt: hit.count, remaining: MAX_ATTEMPTS - hit.count, locked: false, retryAfterSec: 0 };
  }

  async clear(key: string): Promise<void> {
    await Promise.all([this.limiter.reset(`pwfail:${key}`), this.limiter.reset(`pwlock:${key}`)]);
  }
}

export function lockedMessage(retryAfterSec: number, what = "this account"): string {
  const min = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many wrong passwords. ${what[0]!.toUpperCase()}${what.slice(1)} is locked for ${min} more minute${min === 1 ? "" : "s"}.`;
}

/** Wording for a wrong password; attempts before {@link WARN_FROM} get no warning. */
export function wrongPasswordMessage(base: string, o: AttemptOutcome, what = "this account"): string {
  if (o.locked) return `${base} ${lockedMessage(o.retryAfterSec, what).replace("Too many wrong passwords. ", "That was the last attempt: ")}`;
  if (o.attempt < WARN_FROM) return base;
  return `${base} Warning: ${o.remaining} attempt${o.remaining === 1 ? "" : "s"} left before ${what} is locked for ${LOCK_MINUTES} minutes.`;
}

export function attemptMeta(o: AttemptOutcome): Record<string, unknown> | undefined {
  return o.attempt < WARN_FROM && !o.locked
    ? undefined
    : { attempt: o.attempt, attemptsRemaining: o.remaining, maxAttempts: MAX_ATTEMPTS, locked: o.locked };
}

/**
 * Whether the policy covers this account, and whose owners to alert: the orgs
 * the user belongs to without owning. Accounts that only own orgs are exempt.
 */
export async function lockoutPolicy(db: TabulaDb, userId: string): Promise<{ applies: boolean; orgIds: string[] }> {
  const r = await sql<{ org_id: string; role: string }>`
    SELECT org_id, role FROM core.organization_members
    WHERE user_id = ${userId} AND status = 'active'
  `.execute(db);
  const orgIds = r.rows.filter((x) => x.role !== "owner").map((x) => x.org_id);
  const ownsAny = r.rows.some((x) => x.role === "owner");
  return { applies: !(ownsAny && orgIds.length === 0), orgIds };
}

/** The signed-in user behind a public request's session cookie, if any. */
export async function sessionVisitor(db: TabulaDb, request: FastifyRequest): Promise<{ id: string; email: string } | null> {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return null;
  const r = await sql<{ id: string; email: string }>`
    SELECT u.id, u.email FROM core.sessions s JOIN core.users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashSessionToken(token)} AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'
    LIMIT 1
  `.execute(db);
  return r.rows[0] ?? null;
}

export async function isOrgOwner(db: TabulaDb, userId: string, orgId: string): Promise<boolean> {
  const r = await sql<{ n: number }>`
    SELECT 1 AS n FROM core.organization_members
    WHERE user_id = ${userId} AND org_id = ${orgId} AND role = 'owner' AND status = 'active' LIMIT 1
  `.execute(db);
  return r.rows.length > 0;
}

interface OwnerRow {
  user_id: string;
  email: string;
  org_id: string;
  org_name: string;
}

async function ownersOf(db: TabulaDb, orgIds: string[], exceptUserId?: string | null): Promise<OwnerRow[]> {
  if (orgIds.length === 0) return [];
  const r = await sql<OwnerRow>`
    SELECT m.user_id, u.email, m.org_id, o.name AS org_name
    FROM core.organization_members m
    JOIN core.users u ON u.id = m.user_id AND u.status = 'active'
    JOIN core.organizations o ON o.id = m.org_id
    WHERE m.org_id = ANY(${orgIds}::uuid[]) AND m.role = 'owner' AND m.status = 'active'
  `.execute(db);
  return r.rows.filter((o) => o.user_id !== exceptUserId);
}

export interface FailedAttemptAlert {
  kind: "sign_in" | "share";
  orgIds: string[];
  /** The account being signed into, or the signed-in visitor of a share (may be null). */
  email: string | null;
  targetUserId?: string | null;
  ip: string | null;
  userAgent: string | null;
  outcome: AttemptOutcome;
  /** Share label, e.g. "Grid view in Sales base". */
  shareLabel?: string;
  link?: string | null;
}

/** Tell the owners right away; failures here never block the response. */
export async function alertOwners(db: TabulaDb, a: FailedAttemptAlert): Promise<void> {
  try {
    const owners = await ownersOf(db, a.orgIds, a.targetUserId);
    if (owners.length === 0) return;
    const who = a.email ?? "an anonymous visitor";
    const where = a.kind === "sign_in" ? `sign in as ${who}` : `open the password-protected share “${a.shareLabel ?? "share"}”`;
    const state = a.outcome.locked
      ? `Locked for ${LOCK_MINUTES} minutes after ${MAX_ATTEMPTS} wrong passwords.`
      : `Wrong password ${a.outcome.attempt} of ${MAX_ATTEMPTS}.`;
    const title = a.outcome.locked
      ? a.kind === "sign_in"
        ? `Account locked: ${who}`
        : "Share locked after wrong passwords"
      : `Wrong password attempt: ${a.kind === "sign_in" ? who : (a.shareLabel ?? "share")}`;
    const text = `Someone tried to ${where} with a wrong password from IP ${a.ip ?? "unknown"}. ${state}`;
    const lines = [
      text,
      "",
      `Email: ${a.email ?? "(not signed in)"}`,
      `IP address: ${a.ip ?? "unknown"}`,
      `Browser: ${a.userAgent ?? "unknown"}`,
      `Time: ${new Date().toISOString()}`,
      ...(a.shareLabel ? [`Share: ${a.shareLabel}`] : []),
      "",
      "If this wasn't expected, check the account's devices in Admin → Security, or disable the share link.",
    ];
    await createNotifications(
      db,
      owners.map((o) => ({
        userId: o.user_id,
        workspaceId: null,
        baseId: null,
        category: "system" as const,
        title,
        text,
        link: a.link ?? "/admin",
        actorUserId: null,
        data: { kind: "wrong_password", email: a.email, ip: a.ip, attempt: a.outcome.attempt, locked: a.outcome.locked },
      })),
    );
    const byEmail = new Map(owners.map((o) => [o.email, o]));
    for (const o of byEmail.values()) {
      await sendEmail(db, {
        to: [o.email],
        subject: `[TableOS] ${title}`,
        text: [`Organization: ${o.org_name}`, "", ...lines].join("\n"),
        orgId: o.org_id,
        source: "security",
      }).catch(() => undefined);
    }
  } catch (err) {
    console.error("[lockout] owner alert failed", err);
  }
}
