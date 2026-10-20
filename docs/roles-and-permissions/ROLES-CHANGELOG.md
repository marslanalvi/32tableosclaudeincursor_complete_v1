# TableOS roles and permissions — history

This document tracks **account types, roles, permissions and privileges** across releases:
what we had, what we have now, and what is planned. It's updated with every release that changes
who can do what. Details and evidence: `TableOS-Roles-and-Permissions.pdf`. The decisions behind
each change: `Roles-Decisions-Questionnaire.md`.

## Where we are

| Roles version | App version | Status | Summary |
|---|---|---|---|
| R1 | up to 0.13.0 | had | Anyone could sign up and got their own organization; everyone could create workspaces; anyone who could open a base could copy or export it. |
| R2 | 0.14.0 | had (phase 1) | Sign-up by invitation or allowed domain; Owners and Admins run workspaces, bases, duplicates and exports. |
| R3 | 0.15.0 | had (phase 2) | Three account types (Owner, Admin, Member); several Owners and transfer; Admins manage Members but only reach what they're given; one invite form. |
| **R4** | **0.16.0** | **have (phase 3)** | Two-factor for everyone, 30-day sessions, share links for Creators with copy rules enforced, "Runs as", move bases, private member emails, Activity log. |
| — | later | open | Interface-only role (G10), postponed until you decide on roles (B12). |

## Account types

Account types are the **organization role**: they decide what someone can run in the organization.
Data roles (Workspace Owner, Creator, Editor, Commenter, Viewer) decide what they can do inside a
workspace or base.

| Account type | R1 (had) | R2 (0.14.0) | R3–R4 (have, 0.15.0+) |
|---|---|---|---|
| Owner | One per organization, the person who signed up. Everything, plus Members & access. | Same. The only one who manages people. | **One or more.** Everything: every workspace and base, all people including Admins and Owners, billing, Activity log. Only Owners change account types. **Transfer ownership** makes someone Owner and you Admin; at least one Owner always remains. Exempt from lockout and device approval, but needs two-factor like everyone (R4). |
| Admin | Defined but nobody could be made Admin. Implicit owner of every workspace. | Same as R1, plus create workspaces, bases, duplicate and export. | **Assigned by Owners.** Invites and manages **Members** (roles, end dates, No access, suspend, remove, devices); creates workspaces; renames, deletes or moves bases between workspaces; creates API tokens (sees only their own); changes security settings; sees the device log and **Activity log** (R4). **Opens only what an Owner gives them.** No billing. |
| Member | Everyone else. Could create workspaces and had their own organization. | Opens only what they're given. | Same. Sees other people's names but not their emails (R4). |
| Billing admin, Guest | Defined, unused. | Same. | **Removed** (R3). |

## Who can do what

| Action | R1 (had) | R2 (0.14.0) | R3 (0.15.0) | R4 (have, 0.16.0) |
|---|---|---|---|---|
| Create an account | Anyone | Invitation or allowed domain | Same | Same |
| Sign in | Password (two-factor optional) | Same | Same | **Password + two-factor code for everyone** |
| Stay signed in | Never expires | Same | Same | **30 days without activity** (each visit restarts it) |
| Create a workspace | Everyone | Owners and Admins | Same | Same |
| Create a base | Workspace Creators and up | Owners and Admins | Owners; Admins where Creator | Same |
| Duplicate / export | Anyone who could open it | Owners and Admins | Owners; Admins on bases they open | Same |
| Move a base to another workspace | Not possible | Not possible | Not possible | **Owners, Admins, or Workspace Owner of both** (same organization) |
| Invite people | Owner | Owner | Owners and Admins (one form) | Same |
| Change roles, suspend, remove, devices | Owner | Owner | Owners; Admins for Members | Same |
| Share links | Editors and up; "allow copy" not enforced | Same | Same | **Creators and up; "allow copy" enforced** |
| Edit a field set to "Nobody" / "Creators" | Nobody / Creators (Owner locked out by "Nobody") | Same | Same | **Owners and Creators always can** |
| Who an automation acts as | Whoever saved it last | Same | Same | **"Runs as" shown; a Creator picks a Creator** |
| Notifications from bases you lost | Still shown | Same | Same | **Hidden** |
| Member emails in member lists | Everyone | Same | Same | **Owners, Admins, Workspace Owners** (others see names) |
| Activity (audit) log | No screen | Same | Device log only | **Activity tab for Owners and Admins** |
| Billing | Owner, Billing admin | Same | Owners | Same |
| Lockout and device approval | Everyone except the Owner | Same | Everyone except Owners | Same |

## Gaps (from the PDF)

| Gap | What | Status |
|---|---|---|
| G1 | Everyone gets a personal organization | **Closed in 0.14.0.** The 13 personal organizations on live were removed on 2026-10-19 (reversible). |
| G2 | Duplicate copies data out of the organization | **Closed in 0.14.0.** |
| G3 | Everyone can create workspaces | **Closed in 0.14.0** |
| G4 | Anyone who can read can export | **Closed in 0.14.0** |
| G5 | Open sign-up | **Closed in 0.14.0** |
| G6 | Only one Owner, no transfer | **Closed in 0.15.0** |
| G7 | Half-built Admin; unused Billing admin and Guest | **Closed in 0.15.0** |
| G8 | Only the Owner can invite; Workspace Owner can't be given | **Closed in 0.15.0** |
| G9 | Contacts visible with only a base role | **Closed in 0.14.0** |
| G10 | Interface-only access | Postponed (keep roles minimal, B12) |
| G11 | Two different invite dialogs | **Closed in 0.15.0** |
| G12 | Sessions never expire | **Closed in 0.16.0** (30 days without activity) |
| G13 | Two-factor optional | **Closed in 0.16.0** (required for everyone; Owners keep the lockout/device exemption) |
| G14 | Share links and "allow copy" | **Closed in 0.16.0** |
| G15 | Owners and Creators can lose edit rights | **Closed in 0.16.0** |
| G16 | Automations' "Runs as" hidden | **Closed in 0.16.0** |
| G17 | Notifications from bases you can't open | **Closed in 0.16.0** |
| G18 | Can't move a base to another workspace | **Closed in 0.16.0** |
| G19 | Member emails visible to everyone | **Closed in 0.16.0** |
| G20 | No activity log for access changes | **Closed in 0.16.0** |

## Release notes

### R4 — 0.16.0 (2026-10-20)
- Two-factor sign-in required for everyone; setup page before anything else; can't be turned off.
- Sessions end after 30 days without activity.
- Share links for Creators and up; "allow copy" enforced (no copy/cut/drag/right-click, no attachment
  downloads, 50 records per request).
- Owners and Creators always edit fields; automations "Runs as"; hidden notifications for closed bases;
  Move to workspace; member emails for Owners, Admins and Workspace Owners; Activity log.
- On live after deploy: all 10 people (none has two-factor yet) are asked to set it up at their next click.

### R3 — 0.15.0 (2026-10-20)
- Three account types: Owner, Admin, Member. Billing admin and Guest removed (nobody on live held them).
- Several Owners; Transfer ownership; at least one Owner always remains.
- Admins as defined in B3, limited to what an Owner gives them; Admins no longer get automatic access.
- Invitations carry an account type; Admin/Owner invitations can come without any workspace.
- Workspace Owner role can be given; Home Share uses the Members & access invite form.
- Live: you chose to invite ai.deptbcc@bluecascade.org and ai.departmentbluecascade@gmail.com (Owners) and
  awais.ahmed@bluecascade.org (Admin) yourself from Members & access; Arslan stays an Owner.

### R2 — 0.14.0 (2026-10-19)
- Sign-up restricted to invitations and allowed email domains; no personal organizations.
- Allowed sign-up domains in Members & access → Security.
- Workspaces, bases, duplicating and exporting limited to Owners and Admins.
- Contacts directory limited to people with a workspace role.
- Live, approved and done on 2026-10-19: the 13 personal organizations were removed (soft delete:
  25 workspaces and 3 small test bases trashed; backup `.data/r16-removed-orgs-live-1792482088001.json`
  restores them). Allowed sign-up domains on the company organization: @bluecascade.org, @gmail.com.

### R1 — up to 0.13.0
- Starting point described in `TableOS-Roles-and-Permissions.pdf` (version 1).
