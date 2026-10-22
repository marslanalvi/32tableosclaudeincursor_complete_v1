import type { TableOSDb } from "@tableos/db";
import { sql } from "kysely";
import { createNotifications } from "../notifications/create.js";

/**
 * Who may create an account (questionnaire B1, G1, G5).
 *
 * - "restricted" (default): an account can only be created with a pending invitation for that
 *   email, or with an email domain an organization allows (Security → Allowed sign-up domains).
 *   Such accounts never get an organization of their own: invited people join through the
 *   invitation, domain sign-ups join that organization as a Member with no access yet.
 * - "open": the old behaviour (every sign-up creates an organization). Platform setting only,
 *   used by the local test suites.
 * A fresh installation without any organization lets the first sign-up create one.
 */
export type SignupDecision =
  | { kind: "create_org" }
  | { kind: "invited"; orgId: string }
  | { kind: "domain"; orgId: string }
  | { kind: "denied" };

export async function signupMode(db: TableOSDb): Promise<"open" | "restricted"> {
  const r = await sql<{ value: unknown }>`SELECT value FROM core.platform_settings WHERE key = 'signup_mode'`
    .execute(db)
    .catch(() => ({ rows: [] as { value: unknown }[] }));
  return r.rows[0]?.value === "open" ? "open" : "restricted";
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}

/** Normalised list of allowed sign-up domains from an organization's settings. */
export function allowedDomainsOf(settings: unknown): string[] {
  const raw = (settings as { signup?: { allowedDomains?: unknown } } | null)?.signup?.allowedDomains;
  return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string" && d.length > 0) : [];
}

export async function decideSignup(db: TableOSDb, emailNormalized: string): Promise<SignupDecision> {
  if ((await signupMode(db)) === "open") return { kind: "create_org" };
  const any = await sql<{ n: number }>`SELECT 1 AS n FROM core.organizations WHERE status = 'active' LIMIT 1`.execute(db);
  if (!any.rows[0]) return { kind: "create_org" };

  const invite = await sql<{ org_id: string }>`
    SELECT org_id FROM core.invitations
    WHERE (email_normalized = ${emailNormalized} OR lower(email) = ${emailNormalized}) AND status = 'pending' AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1
  `.execute(db);
  if (invite.rows[0]) return { kind: "invited", orgId: invite.rows[0].org_id };

  const domain = emailDomain(emailNormalized);
  const org = await sql<{ id: string }>`
    SELECT id FROM core.organizations
    WHERE status = 'active' AND coalesce(settings -> 'signup' -> 'allowedDomains', '[]'::jsonb) ? ${domain}
    ORDER BY created_at LIMIT 1
  `.execute(db);
  if (org.rows[0]) return { kind: "domain", orgId: org.rows[0].id };
  return { kind: "denied" };
}

/** Bell notification to Owners and Admins: someone joined through an allowed email domain. */
export async function notifyDomainJoin(db: TableOSDb, orgId: string, user: { id: string; name: string; email: string }): Promise<void> {
  try {
    const managers = await sql<{ user_id: string }>`
      SELECT user_id FROM core.organization_members
      WHERE org_id = ${orgId} AND role IN ('owner', 'admin') AND status = 'active' AND user_id <> ${user.id}
    `.execute(db);
    await createNotifications(
      db,
      managers.rows.map((m) => ({
        userId: m.user_id,
        workspaceId: null,
        baseId: null,
        category: "system" as const,
        title: `New member: ${user.name || user.email}`,
        text: `${user.name || user.email} (${user.email}) created an account with an allowed email domain and joined your organization. They can't open anything until you give them a workspace or base in Members & access.`,
        link: "/admin?tab=people",
        actorUserId: user.id,
        data: { kind: "domain_signup", email: user.email },
      })),
    );
  } catch (err) {
    console.error("[signup] domain-join notification failed", err);
  }
}
