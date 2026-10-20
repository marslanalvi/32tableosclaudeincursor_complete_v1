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
| **R3** | **0.15.0** | **have (phase 2)** | Three account types (Owner, Admin, Member); several Owners and transfer; Admins manage Members but only reach what they're given; one invite form. |
| R4 | phase 3 | planned | Two-factor for everyone, 30-day sessions, share-link rules, activity log and the remaining gaps. |

## Account types

Account types are the **organization role**: they decide what someone can run in the organization.
Data roles (Workspace Owner, Creator, Editor, Commenter, Viewer) decide what they can do inside a
workspace or base.

| Account type | R1 (had) | R2 (0.14.0) | R3 (have, 0.15.0) |
|---|---|---|---|
| Owner | One per organization, the person who signed up. Everything, plus Members & access. | Same. The only one who manages people. | **One or more.** Everything: every workspace and base, all people including Admins and Owners, billing. Only Owners change account types. **Transfer ownership** makes someone Owner and you Admin; at least one Owner always remains. |
| Admin | Defined but nobody could be made Admin. Implicit owner of every workspace. | Same as R1, plus create workspaces, bases, duplicate and export. Nobody could be made Admin. | **Assigned by Owners.** Invites and manages **Members** (roles, end dates, No access, suspend, remove, devices); creates workspaces; renames or deletes any workspace; creates API tokens (sees only their own); changes security settings; sees the device log. **Opens only what an Owner gives them**, hands out access only where they're Creator, never above their own role. No billing. Can't act on Owners, other Admins or themselves. |
| Member | Everyone else. Could create workspaces and had their own organization. | Opens only what they're given. No workspaces, bases, duplicates or exports. | Same as R2. |
| Billing admin | Defined, unused. | Defined, unused. | **Removed.** |
| Guest | Defined, unused. | Defined, unused. | **Removed.** |

## Who can do what

| Action | R1 (had) | R2 (0.14.0) | R3 (have, 0.15.0) | Planned |
|---|---|---|---|---|
| Create an account | Anyone | Invitation, or an email at an allowed domain | Same | — |
| Own organization on sign-up | Everyone | Nobody | Same | — |
| Create a workspace | Everyone | Owners and Admins (choose the organization) | Same | — |
| Create a base | Workspace Creators and up | Owners and Admins | Owners; Admins in workspaces where they're Creator or Workspace Owner | — |
| Duplicate a base / export | Anyone who could open it | Owners and Admins | Owners; Admins on bases they can open | — |
| Rename / delete a workspace | Workspace owners | Same | Workspace Owners, and Admins (any workspace) | — |
| Invite people | Owner | Owner | **Owners and Admins** (Admins: Members only, within their reach). One form on Members & access and Home Share. Owners can invite Admins and Owners directly. | — |
| Give the Workspace Owner role | Nobody | Nobody | **Owners and Admins** (Admins only where they are Workspace Owner) | — |
| Change roles, end dates, No access | Owner | Owner | Owners; Admins for Members, within their reach | — |
| Suspend / remove people | Owner | Owner | Owners (anyone but themselves); Admins (Members) | — |
| Approve / revoke devices | Owner | Owner | Owners; Admins for Members' devices (not their own) | — |
| API tokens | Owner | Owner | Owners (see all) and Admins (their own; a token reaches only what its creator can) | — |
| Security settings | Owner | Owner | Owners and Admins | — |
| Billing | Owner, Billing admin | Same | Owners | — |
| Share links | Creators and up | Same | Same | Creators and up; "allow copy" enforced |
| Two-factor sign-in | Optional | Optional | Optional | Required for everyone |
| Session length | Never expires | Same | Same | 30 days |
| Lockout and device approval | Everyone except the Owner | Same | Everyone except Owners | Same |

## Gaps (from the PDF)

| Gap | What | Status |
|---|---|---|
| G1 | Everyone gets a personal organization | **Closed in 0.14.0.** The 13 personal organizations on live were removed on 2026-10-19 (reversible). |
| G2 | Duplicate copies data out of the organization | **Closed in 0.14.0.** Live check: no cross-organization copies found. |
| G3 | Everyone can create workspaces | **Closed in 0.14.0** |
| G4 | Anyone who can read can export | **Closed in 0.14.0** |
| G5 | Open sign-up | **Closed in 0.14.0** (invitation or allowed domain) |
| G6 | Only one Owner, no transfer | **Closed in 0.15.0** (several Owners, transfer) |
| G7 | Half-built Admin; unused Billing admin and Guest | **Closed in 0.15.0** (Admin completed, the two roles removed) |
| G8 | Only the Owner can invite; Workspace Owner can't be given | **Closed in 0.15.0** (Owners and Admins, per B3/B5) |
| G9 | Contacts visible with only a base role | **Closed in 0.14.0** |
| G10 | Interface-only access | Postponed (keep roles minimal, B12) |
| G11 | Two different invite dialogs | **Closed in 0.15.0** (one form) |
| G12 | Sessions never expire | Planned, phase 3 |
| G13 | Two-factor optional | Planned, phase 3 |
| G14 | Share links and "allow copy" | Planned, phase 3 |
| G15 | Owners and Creators can lose edit rights | Planned, phase 3 |
| G16 | Automations' "Runs as" hidden | Planned, phase 3 |
| G17 | Notifications from bases you can't open | Planned, phase 3 |
| G18 | Can't move a base to another workspace | Planned, phase 3 |
| G19 | Member emails visible to everyone | Planned, phase 3 |
| G20 | No activity log for access changes | Planned, phase 3 (Admins already see the device log) |

## Release notes

### R3 — 0.15.0 (2026-10-20)
- Three account types: Owner, Admin, Member. Billing admin and Guest removed (nobody on live held them).
- Several Owners; Transfer ownership; at least one Owner always remains.
- Admins as defined in B3, limited to what an Owner gives them; Admins no longer get automatic access.
- Invitations carry an account type; Admin/Owner invitations can come without any workspace.
- Workspace Owner role can be given; Home Share uses the Members & access invite form.
- Pending your approval on live: invite ai.deptbcc@bluecascade.org and ai.departmentbluecascade@gmail.com
  as Owners and awais.ahmed@bluecascade.org as Admin (none of them has an account yet).

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
