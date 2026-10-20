# TableOS roles and permissions — history

This document tracks **account types, roles, permissions and privileges** across releases:
what we had, what we have now, and what is planned. It's updated with every release that changes
who can do what. Details and evidence: `TableOS-Roles-and-Permissions.pdf`. The decisions behind
each change: `Roles-Decisions-Questionnaire.md`.

## Where we are

| Roles version | App version | Status | Summary |
|---|---|---|---|
| R1 | up to 0.13.0 | had | Anyone could sign up and got their own organization; everyone could create workspaces; anyone who could open a base could copy or export it. |
| **R2** | **0.14.0** | **have (phase 1)** | Sign-up by invitation or allowed domain; Owners and Admins run workspaces, bases, duplicates and exports. |
| R3 | phase 2 | planned | Three account types (Owner, Admin, Member); several Owners; Admins only get what they're assigned; one invite dialog. |
| R4 | phase 3 | planned | Two-factor for everyone, 30-day sessions, share-link rules, activity log and the remaining gaps. |

## Account types

Account types are the **organization role**: they decide what someone can run in the organization.
Data roles (Creator, Editor, Commenter, Viewer) decide what they can do inside a workspace or base.

| Account type | R1 (had) | R2 (have, 0.14.0) | R3 (planned) |
|---|---|---|---|
| Owner | One per organization, the person who signed up. Everything, plus Members & access. | Same. The only one who manages people (Members & access). | One or more Owners; ownership can be transferred. Only Owners create Admins and Owners. Planned Owners: ai.deptbcc@bluecascade.org, ai.departmentbluecascade@gmail.com. |
| Admin | Defined but nobody could be made Admin. Implicit owner of every workspace. | Same as R1, plus may create workspaces, bases, duplicate and export. Still nobody can be made Admin from the UI. | Invite people; change roles, dates and "No access"; suspend or remove members (not Owners); approve devices; create, rename and delete workspaces; API tokens; security settings; audit log. Data access only where assigned. No billing. First Admin: awais.ahmed@bluecascade.org. |
| Member | Everyone else. Could create workspaces and had their own organization. | Can only open what they're given. No workspaces, bases, duplicates or exports. | Same as R2. |
| Billing admin | Defined, unused. | Defined, unused. | Removed. |
| Guest | Defined, unused. | Defined, unused. | Removed. |

## Who can do what

| Action | R1 (had) | R2 (have, 0.14.0) | Planned |
|---|---|---|---|
| Create an account | Anyone | Only with a pending invitation, or an email at an allowed domain (set per organization in Security; joins as Member with no access, Owners and Admins are notified) | — |
| Get an organization of your own | Everyone, on sign-up | Nobody (only the very first account on a new installation) | — |
| Create a workspace | Everyone | Owners and Admins; they choose the organization if they run several | Same |
| Create a base | Workspace Creators and up | Owners and Admins | Same |
| Duplicate a base | Anyone who could open it, into any workspace (even another organization) | Owners and Admins, same organization only | Same |
| Export CSV / Excel | Anyone who could open the table | Owners and Admins (copy and paste in the grid still works) | Same |
| Workspace contacts directory | Anyone who could reach any base in the workspace | Only people with a role on the workspace | Same |
| Rename / delete a workspace | Workspace owners | Same (menu hidden for others) | Owners and Admins |
| Invite people | Owner | Owner | Owners and Admins, one invite dialog everywhere; the workspace Owner role can be given |
| Change roles and access dates | Owner | Owner | Owners and Admins (Admins can't change Owners) |
| Share links | Creators and up (Viewers refused) | Same | Creators and up; "allow copy" enforced |
| Two-factor sign-in | Optional | Optional | Required for everyone |
| Session length | Never expires | Same | 30 days |
| Lockout and device approval | Everyone except the Owner | Same | Same (Owner stays exempt) |

## Gaps (from the PDF)

| Gap | What | Status |
|---|---|---|
| G1 | Everyone gets a personal organization | **Closed in 0.14.0** (code). Live clean-up of 13 personal organizations is waiting for approval. |
| G2 | Duplicate copies data out of the organization | **Closed in 0.14.0.** Live check: no cross-organization copies found. |
| G3 | Everyone can create workspaces | **Closed in 0.14.0** |
| G4 | Anyone who can read can export | **Closed in 0.14.0** |
| G5 | Open sign-up | **Closed in 0.14.0** (invitation or allowed domain) |
| G6 | Only one Owner, no transfer | Planned, phase 2 |
| G7 | Unused billing_admin and guest roles | Planned, phase 2 |
| G8 | Only the Owner can invite | Planned, phase 2 |
| G9 | Contacts visible with only a base role | **Closed in 0.14.0** |
| G10 | Interface-only access | Postponed (keep roles minimal, B12) |
| G11 | Two different invite dialogs | Planned, phase 2 |
| G12 | Sessions never expire | Planned, phase 3 |
| G13 | Two-factor optional | Planned, phase 3 |
| G14 | Share links and "allow copy" | Planned, phase 3 |
| G15 | Owners and Creators can lose edit rights | Planned, phase 3 |
| G16 | Automations' "Runs as" hidden | Planned, phase 3 |
| G17 | Notifications from bases you can't open | Planned, phase 3 |
| G18 | Can't move a base to another workspace | Planned, phase 3 |
| G19 | Member emails visible to everyone | Planned, phase 3 |
| G20 | No activity log for access changes | Planned, phase 3 |

## Release notes

### R2 — 0.14.0 (2026-10-19)
- Sign-up restricted to invitations and allowed email domains; no personal organizations.
- Allowed sign-up domains in Members & access → Security.
- Workspaces, bases, duplicating and exporting limited to Owners and Admins.
- Contacts directory limited to people with a workspace role.
- Pending your approval: removing the 13 personal organizations on live (report in
  `.data/r16-live-cleanup-report.json`; reversible).

### R1 — up to 0.13.0
- Starting point described in `TableOS-Roles-and-Permissions.pdf` (version 1).
