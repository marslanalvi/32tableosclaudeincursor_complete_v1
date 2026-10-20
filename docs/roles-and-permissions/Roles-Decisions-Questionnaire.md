# TableOS — Roles & Permissions: Decisions Questionnaire

Companion to **TableOS-Roles-and-Permissions.pdf** (version 0.13.0). Fill this in, save it, and send it back as your next prompt. Every answer becomes an instruction.

**How to fill it in**

- Tick exactly one box per question by changing `[ ]` to `[x]`, unless the question says "tick all that apply".
- **(recommended)** marks my suggestion. You don't have to follow it.
- Write anything extra on the `Notes:` lines. Leave them empty if you have nothing to add.
- If a question doesn't matter to you, leave it unticked; I'll use the recommended option.

---

## Part A — Gaps and risks

For each gap, choose:

- **Severity**: how serious it is for your business.
- **Decision**: what to do about it.
- **When**: which phase to do it in.

Phases:

- **Phase 1**: next release, urgent.
- **Phase 2**: structure changes.
- **Phase 3**: hardening.
- **Later**: not planned yet.

### G1 — Every account owns a personal organization

Today, everyone who signs up (including people you invite) gets their own organization and "Home" workspace, where they are Owner and can create anything.

- Severity: [x] Critical  [ ] High (recommended)  [ ] Medium  [ ] Low  [ ] Not a problem
- Decision: [x] Fix as proposed in Part B  [ ] Fix differently (explain below)  [ ] Keep as it is
- When: [x] Phase 1  [ ] Phase 2 (recommended)  [ ] Phase 3  [ ] Later

Notes:

### G2 — Any role can copy a whole base, with records, into their own workspace

Today even a Viewer can do it. After removal the copy stays hidden in your data.

- Severity: [x] Critical (recommended)  [ ] High  [ ] Medium  [ ] Low  [ ] Not a problem
- Decision: [ ] Only Creators can duplicate, and only inside the same organization (recommended)  [x] Only Owners and Admins can duplicate  [ ] Disable duplicating completely  [ ] Keep as it is
- Clean up copies that already exist in other organizations: [ ] Yes, delete them  [x] Yes, but list them for me first (recommended)  [ ] No
- When: [x] Phase 1 (recommended)  [ ] Phase 2  [ ] Phase 3  [ ] Later

Notes:

### G3 — Everyone can create workspaces

- Severity: [x] Critical  [ ] High (recommended)  [ ] Medium  [ ] Low  [ ] Not a problem
- Decision: [x] Add the setting "Who can create workspaces" (answer in Part B, question B4) (recommended)  [ ] Keep as it is
- When: [x] Phase 1 (recommended)  [ ] Phase 2  [ ] Phase 3  [ ] Later

Notes: only owners & admins should be able to create workspaces

### G4 — Every role (including Viewer) can export CSV or Excel

- Severity: [ ] Critical  [x] High (recommended)  [ ] Medium  [ ] Low  [ ] Not a problem
- Decision: [x] Add the setting "Who can export" (answer in Part B, question B7) (recommended)  [ ] Keep as it is
- When: [x] Phase 1 (recommended)  [ ] Phase 2  [ ] Phase 3  [ ] Later

Notes:

### G5 — Open sign-up: anyone can create an account and organization

- Severity: [ ] Critical  [x] High (recommended)  [ ] Medium  [ ] Low  [ ] Not a problem
- Decision: [x] Change sign-up (answer in Part B, question B1) (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [x] Phase 2 (recommended)  [ ] Phase 3  [ ] Later

Notes:

### G6 — Only one person (the Owner) can manage people, and ownership can't be transferred

- Severity: [ ] Critical  [x] High (recommended)  [ ] Medium  [ ] Low  [ ] Not a problem
- Decision: [x] Allow several Owners plus transfer of ownership, and an Admin role (Part B, questions B2–B3) (recommended)  [ ] Only add an Admin role  [ ] Keep as it is
- When: [ ] Phase 1  [x] Phase 2 (recommended)  [ ] Phase 3  [ ] Later

Notes:

### G7 — The Admin role is half-built; Billing admin and Guest are unused

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [ ] Complete Admin as defined in question B3 (recommended)  [x] Remove the unused roles  [ ] Keep as it is
- When: [ ] Phase 1  [x] Phase 2 (recommended)  [ ] Phase 3  [ ] Later

Notes: i don't want billing admin and guest, also i want owner to manage people (along with admin) and other everything 

### G8 — Workspace Owners and base Creators can't invite; workspace Owner can't be assigned

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] Follow the answer to question B5 (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [x] Phase 2 (recommended)  [ ] Phase 3  [ ] Later

Notes:

### G9 — The contacts directory is open to every organization member

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] Require a role on the workspace (recommended)  [ ] Keep as it is
- When: [x] Phase 1 (recommended)  [ ] Phase 2  [ ] Phase 3  [ ] Later

Notes:

### G10 — No interface-only access

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] Add an "Interface only" role (people use interfaces without seeing the base) (recommended)  [ ] Not needed
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G11 — Two invite screens behave differently (Home "Share" always gives the whole workspace)

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] One invite dialog everywhere, with "whole workspace or selected bases" (recommended)  [ ] Remove the Home "Share" invite  [ ] Keep as it is
- When: [ ] Phase 1  [x] Phase 2 (recommended)  [ ] Phase 3  [ ] Later

Notes:

### G12 — Sessions never expire

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] Session length setting (answer in Part B, question B10) (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G13 — The Owner account is exempt from lockout and device approval, and two-factor sign-in is optional

- Severity: [x] Critical  [ ] High  [ ] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] Follow the answers to questions B9 and B11 (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G14 — Any Editor can publish public share links; no organization control; "allow copy" isn't enforced

- Severity: [ ] Critical  [ ] High  [x] Medium (recommended)  [ ] Low  [ ] Not a problem
- Decision: [x] Follow the answer to question B8 (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G15 — The field permission "Nobody" also locks out the Owner and Creators

- Severity: [ ] Critical  [ ] High  [ ] Medium  [x] Low (recommended)  [ ] Not a problem
- Decision: [x] Owners and base Creators can always edit (recommended)  [ ] "Nobody" really means nobody (keep)
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G16 — An automation runs as whoever last saved it

- Severity: [ ] Critical  [ ] High  [ ] Medium  [x] Low (recommended)  [ ] Not a problem
- Decision: [x] Show "Runs as …" and let the Creator choose it (recommended)  [ ] Always run as the original creator  [ ] Keep as it is
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G17 — Old notifications stay visible after someone loses access to a base

- Severity: [ ] Critical  [ ] High  [ ] Medium  [x] Low (recommended)  [ ] Not a problem
- Decision: [x] Hide notifications from bases the person can no longer open (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G18 — No "Move base to another workspace"

- Severity: [ ] Critical  [ ] High  [ ] Medium  [x] Low (recommended)  [ ] Not a problem
- Decision: [x] Add "Move to workspace" (same organization, Owners and Admins or workspace Owners) (recommended)  [ ] Not needed
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G19 — Workspace member lists show everyone's email to all members

- Severity: [ ] Critical  [ ] High  [ ] Medium  [x] Low (recommended)  [ ] Not a problem
- Decision: [x] Only Owners, Admins and workspace Owners see emails; others see names (recommended)  [ ] Keep as it is
- When: [ ] Phase 1  [ ] Phase 2  [x] Phase 3 (recommended)  [ ] Later

Notes:

### G20 — No audit-log screen

- Severity: [ ] Critical  [ ] High  [ ] Medium  [x] Low (recommended)  [ ] Not a problem
- Decision: [x] Add an "Activity log" tab in Members & access (Owners and Admins) (recommended)  [ ] Not needed
- When: [ ] Phase 1  [ ] Phase 2  [ ] Phase 3 (recommended)  [ ] Later

Notes:

### Anything I missed?

Describe any other gap or risk you noticed while testing:

1. you did good, but there are alot of things right now, and i did what i could best, right now just do it, complete it and after that we will review it again
2.

---

## Part B — Recommended model and decisions

### B1 — Sign-up

- [x] Invite only: people can only create an account from an invitation (recommended)
- [x] Allowed email domains only (write the domains: @bluecascade.org, @gmail.com, i should option to add more allowed domains)
- [x] Invite only, plus allowed domains
- [ ] Open to anyone (as today)

Who may still create a brand-new organization?

- [x] Nobody except me (the current Owner) (recommended)
- [ ] People I approve
- [ ] Anyone who signs up

Notes:

### B2 — Organization Owners

How many Owners?

- [x] One or more (recommended)
- [ ] Exactly one

Can ownership be transferred?

- [x] Yes, the current Owner hands it over (recommended)
- [ ] No

Who should be Owner(s) now (emails)?

Notes: ai.deptbcc@bluecascade.org, ai.departmentbluecascade@gmail.com

### B3 — Admin role: tick everything an Admin may do

- [x] Invite people
- [x] Change roles and access dates, and set "No access"
- [x] Suspend or remove members (not Owners)
- [x] Approve or revoke devices
- [x] Create workspaces
- [x] Rename or delete any workspace
- [x] Full access to every workspace and base Owner has assigned it to, no access of other bases which are not assigned by the owner
- [x] Create API tokens
- [x] Change security settings (device approval, two-factor, sessions)
- [ ] See billing and upgrade the plan
- [x] See the activity (audit) log

Who should be Admin now (emails)? [awais.ahmed@bluecascade.org](mailto:awais.ahmed@bluecascade.org)

Keep the "Billing admin" role?

- [ ] Yes
- [x] No, remove it (recommended unless you need it)

Keep the "Guest" role, meaning people who only ever get selected bases and can never create anything?

- [x] Yes, and invited base-only people become Guests (recommended)
- [ ] No

Notes:

### B4 — Who can create workspaces

- [ ] Owners only
- [x] Owners and Admins (recommended)
- [ ] Owners, Admins and specific people (emails: ______________ )
- [ ] Everyone (as today)

When a person belongs to several organizations, where should a new workspace go?

- [x] Ask which organization (recommended)
- [ ] Always their main organization

Notes: The owner should 

### B5 — Who can invite people

Tick all that apply:

- [x] Owners (always)
- [ ] Admins (recommended)
- [ ] Workspace Owners, into their own workspace
- [ ] Base Creators, into their own base

Can a workspace Owner role be given to other people?

- [x] Yes, by Owners and Admins (recommended)
- [ ] No

Notes:

### B6 — Personal organizations of people already invited (for example Mahad's own "Home")

- [ ] Keep them, but hide them from the Home page
- [ ] Remove them once anything important is moved into the company organization (recommended)
- [x] Remove them right away
- [ ] Keep them as they are

Before anything is removed, show me a list of what's in them:

- [x] Yes (recommended)
- [ ] No

Notes: Nobody other than owner and admin should be able to have their own personal organizations or create workspace or create bases

### B7 — Who can export data (CSV or Excel, and bulk reads through the API)

- [ ] Creators and up (recommended)
- [ ] Editors and up
- [ ] Everyone with access (as today)
- [x] Owners and Admins only

Also apply this to copying records out of the grid (copy and paste)?

- [ ] Yes
- [x] No (recommended)

Notes:

### B8 — Public share links

- [ ] Allowed, but a password is always required
- [ ] Allowed, password optional (as today) (recommended)
- [x] Only Creators and up can create them
- [ ] Turned off for the whole organization

Enforce "allow copy" so visitors can't copy or download from a shared view:

- [x] Yes (recommended)
- [ ] No

Notes:

### B9 — Two-factor sign-in

- [x] Required for everyone
- [ ] Required for Owners and Admins only (recommended)
- [ ] Optional (as today)

Notes:

### B10 — Session length (how long you stay signed in without activity)

- [ ] Never expire (as today)
- [x] 30 days (recommended)
- [ ] 7 days
- [ ] 1 day
- [ ] Other: ______

Notes:

### B11 — Lockout and device approval for the Owner account

- [x] Keep the Owner exempt from both (as today; can't lock yourself out) (recommended if B9 requires two-factor for Owners)
- [ ] Owner also needs device approval (approved by another Owner or Admin)
- [ ] Owner also gets locked after wrong passwords

Notes:

### B12 — Workspace and base roles (confirm or change)

Workspace roles: Owner, Creator, Editor, Commenter, Viewer.

- [ ] Keep (recommended)
- [x] Change: i am not sure about it, just keep the roles minimum right now, i will figure it out later

Base roles: Creator, Editor, Commenter, Viewer, Interface only, No access.

- [ ] Keep (recommended)
- [ ] Change: i am not sure about it, just keep the roles minimum right now, i will figure it out later

A base's own role overrides the workspace role (higher, lower or none):

- [ ] Keep (recommended)
- [ ] Base role may only raise access (Airtable style)

Notes: i am not sure about it, just keep the roles minimum right now, i will figure it out later

### B13 — What each base role may do

Change anything you disagree with, for example "Commenters shouldn't create personal views":

| Action                                                     | Today's minimum role | Your choice                                                                               |
| ---------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| Comment, create personal views                             | Commenter            | i am not sure about it, just keep the roles minimum right now, i will figure it out later |
| Edit records, import, create shared views                  | Editor               | i am not sure about it, just keep the roles minimum right now, i will figure it out later |
| Create share links, press automation buttons, Sync now     | Editor               | i am not sure about it, just keep the roles minimum right now, i will figure it out later |
| Fields, tables, automations, interfaces, field permissions | Creator              | i am not sure about it, just keep the roles minimum right now, i will figure it out later |
| Rename or delete the base                                  | Creator              | i am not sure about it, just keep the roles minimum right now, i will figure it out later |
| Duplicate the base                                         | any role (G2)        | i am not sure about it, just keep the roles minimum right now, i will figure it out later |
| Export                                                     | any role (G4)        | i am not sure about it, just keep the roles minimum right now, i will figure it out later |

Notes: i am not sure about it, just keep the roles minimum right now, i will figure it out later

### B14 — Anything else about access you want

Write any rule in your own words, for example "Editors must never delete records" or "Only Owners can delete bases":

1. Owner(s) should be the main account(s), they should be only ones who can create admins, there should be 3 types of accounts right now, owners, admins, members
2.
3.

---

## Part C — How to deliver

Order of work:

- [x] Phase by phase, with a separate release and approval for each phase (recommended)
- [ ] Everything in one release

Live data:

- [x] Show me a list before changing any existing accounts, roles or data on live (recommended)
- [ ] Apply the changes directly

Testing on live after each release:

- [x] I'll test it myself before you merge (recommended)
- [ ] Merge after your tests

Notes:

---

## Part D — Instructions for the assistant (leave as is)

> Implement the decisions in Parts A–C of this questionnaire in TableOS. Where a question is unticked, use the option marked **(recommended)**. Treat my Notes and Part B14 as requirements. Follow the release workflow rule:
>
> 1. Understand the code first.
> 2. Change only what is needed.
> 3. Test each change and the whole suite on the local database only.
> 4. Preview it for me.
> 5. Version it, and update the changelog, release notes, VERSIONING and the work log.
> 6. Push it to a new `release/vX.Y.Z` branch.
> 7. Ask for my approval before merging into master and going live.
>
> Before changing existing live accounts, roles or data, show me exactly what will change. Update `docs/roles-and-permissions/TableOS-Roles-and-Permissions.pdf` so it describes the new behaviour, and mark which gaps are closed.
