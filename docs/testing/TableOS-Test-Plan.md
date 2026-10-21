# TableOS — Complete Test Plan

Plan 1.0 · for TableOS 0.16.2 · generated 2026-10-21 · 32 modules · 279 test cases (P1 134, P2 106, P3 39)

Use **TableOS-Test-Workbook.html** to record results and screenshots, then **Export for developer**. This file and the PDF are the same plan for reading or printing.

## How to test

1. Work module by module (M00 first). Each module is independent once M00 is done.
2. For every case: follow the steps, compare with Expected, then mark Pass, Fail, Blocked (can’t run it because something else is broken) or N/A (feature not used).
3. For a failure: pick a severity, write what actually happened (and what you expected), and attach screenshots (paste with Ctrl+V, drag in, or choose files).
4. Priority: P1 must work (blocker if broken), P2 important, P3 polish.
5. Use the interactive workbook (TableOS-Test-Workbook.html): it saves automatically in your browser. When done (or at any point), click “Export for developer” and send that one file; it contains every result, note and screenshot.
6. Found a problem no case covers? Add it under “Other findings” at the end of the workbook.

## Severity

| Severity | Meaning |
|---|---|
| Critical | Data loss, security hole, or nobody can work. |
| High | A main feature is broken with no workaround. |
| Medium | Broken but there is a workaround, or a secondary feature fails. |
| Low | Cosmetic, wording, small inconvenience. |

## Test accounts

| Name | Account | How to set it up |
|---|---|---|
| OWNER | Owner | ai.deptbcc@bluecascade.org (the account from the fresh start) |
| OWNER2 | Second Owner | A second Owner, invited by OWNER as Owner |
| ADMIN | Admin | Invited by OWNER as Admin; give it Creator on workspace WS-A only |
| CREATOR | Member, base Creator | Invited to base BASE-1 as Creator |
| EDITOR | Member, base Editor | Invited to base BASE-1 as Editor |
| COMMENTER | Member, base Commenter | Invited to base BASE-1 as Commenter |
| VIEWER | Member, workspace Viewer | Invited to workspace WS-A as Viewer (all its bases) |
| DOMAIN | Member via allowed domain | Signs up with an @bluecascade.org (or allowed) email without an invitation |
| OUTSIDER | No account | An email that is not invited and not on an allowed domain |

## Test data

| Name | What |
|---|---|
| WS-A | Workspace “Sales” created by OWNER |
| WS-B | Workspace “Finance” created by OWNER |
| BASE-1 | Base “CRM” in WS-A with tables Contacts, Companies, Deals |
| BASE-2 | Base “Budget” in WS-B |
| CSV-S | A small CSV (20 rows, 6 columns: text, number, date, email, select-like, checkbox) |
| CSV-L | A large CSV (5,000+ rows) for background import |
| XLSX | An Excel file with two sheets |
| CSV-BAD | A CSV with invalid emails, phone numbers and dates mixed in |
| IMG | A few images (PNG/JPG, one larger than 5 MB) and a PDF |

## Modules

| Module | Cases | P1 |
|---|---|---|
| M00 Environment and test accounts | 6 | 5 |
| M01 Sign-up and invitations | 9 | 4 |
| M02 Sign-in, two-factor and sessions | 9 | 2 |
| M03 Sign-in security: wrong passwords and alerts | 6 | 3 |
| M04 Account types: Owner, Admin, Member | 9 | 6 |
| M05 Members & access: invites, roles, end dates | 15 | 10 |
| M06 Device approval | 8 | 3 |
| M07 Security settings and Activity log | 6 | 3 |
| M08 Workspaces | 8 | 4 |
| M09 Bases | 9 | 5 |
| M10 Tables | 6 | 3 |
| M11 Fields and field types | 19 | 10 |
| M12 Editing records in the grid | 10 | 5 |
| M13 Comments, mentions and history | 6 | 4 |
| M14 Undo, redo and trash | 4 | 3 |
| M15 Views | 18 | 7 |
| M16 Links, lookups, rollups and counts | 7 | 4 |
| M17 Formulas | 8 | 4 |
| M18 Synced tables from another base | 8 | 3 |
| M19 Connectors: Airtable, HubSpot, Gmail, Slack | 7 | 0 |
| M20 Import and export | 10 | 6 |
| M21 Attachments | 5 | 2 |
| M22 Forms | 5 | 3 |
| M23 Interfaces | 6 | 2 |
| M24 Automations | 15 | 5 |
| M25 Public share links | 9 | 6 |
| M26 Search, notifications and contacts | 6 | 2 |
| M27 Live collaboration (realtime) | 7 | 2 |
| M28 API and access tokens | 17 | 9 |
| M29 Limits and performance | 7 | 1 |
| M30 Permission matrix spot checks | 8 | 8 |
| M31 Help, UI and browsers | 6 | 0 |

---

## M00 — Environment and test accounts

**Goal:** Get everything the other modules need, and record what you test against.

**Before you start:**

- Use a desktop browser (Chrome or Edge, latest) for OWNER, and a second browser or a private window for every other account.
- Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…). Every account needs two-factor.

### M00-01 · Record the version under test  `P1` `UI`

**Steps**

1. Open Help → Release notes.
2. Open <API>/v1/version in a browser tab.

**Expected:** Both show the same version (e.g. 0.16.2). Note it at the top of this workbook.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M00-02 · OWNER signs in for the first time  `P1` `Security`

**Steps**

1. Sign in as OWNER with the agreed password.

**Expected:** You are taken to “Set up two-factor sign-in” and nothing else opens until it is done.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M00-03 · OWNER sets up two-factor  `P1` `Security`

**Steps**

1. Click Set up two-factor authentication.
2. Scan the QR code with the authenticator app.
3. Enter the 6-digit code and Turn on.

**Expected:** Two-factor turns on and TableOS opens Home. Account → Two-factor shows On and has no “Turn off” option.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M00-04 · Create the test workspaces and base  `P1` `Data`

**Steps**

1. As OWNER create WS-A and WS-B on Home.
2. In WS-A create BASE-1 with tables Contacts, Companies, Deals; in WS-B create BASE-2.

**Expected:** All appear on Home under the right workspace.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M00-05 · Invite the test accounts  `P1` `UI`

**Steps**

1. Members & access → People → invite each account from the Accounts table with the stated account type and access.
2. Each person opens the invitation email (or the copied link), creates an account and sets up two-factor.

**Expected:** Every account can sign in and sees only what it was given.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M00-06 · Prepare the test files  `P2` `Data`

**Steps**

1. Create CSV-S, CSV-L, XLSX, CSV-BAD and IMG on your computer.

**Expected:** Files ready for M20–M22.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M01 — Sign-up and invitations

**Goal:** Only invited people (or allowed email domains) can create accounts; nobody gets a personal organization.

**Before you start:**

- OUTSIDER and DOMAIN are not signed in. Allowed domains are set in M07 first if you test DOMAIN here.

### M01-01 · Sign-up page explains invitations  `P3` `UI`

**Steps**

1. Open /signup while signed out.

**Expected:** The page says TableOS accounts are by invitation.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-02 · Stranger can't sign up  `P1` `Security`

**Steps**

1. Sign up with the OUTSIDER email.

**Expected:** Refused: “TableOS accounts are by invitation only…”. No account is created.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-03 · Invited person signs up from the link  `P1` `UI`

**Steps**

1. Invite a new email to BASE-1 as Viewer.
2. Open the invitation link signed out → Sign up with that email.

**Expected:** Account created, invitation accepted, the person lands on two-factor setup, then sees only BASE-1.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-04 · Invitation for the wrong account  `P2` `Security`

**Steps**

1. While signed in as EDITOR, open an invitation sent to another email.

**Expected:** TableOS says the invitation was sent to another address and asks to sign in with it.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-05 · Expired or cancelled invitation  `P2` `Security`

**Steps**

1. Cancel a pending invitation in Members & access, then open its link.

**Expected:** The link shows “expired or revoked”.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-06 · Allowed-domain sign-up  `P1` `Security`

**Steps**

1. With @bluecascade.org in allowed domains (M07), sign up as DOMAIN without an invitation.

**Expected:** Account created as Member with no access. OWNER and Admins get a bell notification “New member: …”.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-07 · No personal organization  `P1` `Security`

**Steps**

1. After any sign-up above, open the account menu → Members & access, and Home.

**Expected:** No organization or “Home” workspace of their own was created.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-08 · Invitation with an account type  `P2` `UI`

**Steps**

1. As OWNER invite an email as Admin with “No workspace or base yet”. Open the link signed out.

**Expected:** The invitation page says “You’ll join as Admin”. After accepting, the person is Admin.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M01-09 · Re-invite never lowers an account type  `P2` `Security`

**Steps**

1. Invite ADMIN again as a Member to a base and accept it.

**Expected:** ADMIN is still Admin, with the extra base access.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M02 — Sign-in, two-factor and sessions

**Goal:** Sign-in always needs the password and a two-factor code; sessions end after 30 idle days.

### M02-01 · Sign in with code  `P1` `Security`

**Steps**

1. Sign out, sign in as EDITOR with password, enter the authenticator code.

**Expected:** Signed in. A wrong code shows “Invalid authentication code”.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-02 · Too many wrong codes  `P2` `Security`

**Steps**

1. Enter a wrong two-factor code 5 times.

**Expected:** The sign-in attempt expires and you must enter the password again.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-03 · Two-factor can't be turned off  `P1` `Security`

**Steps**

1. Account → Two-factor authentication.

**Expected:** Shows On and a note that it can't be turned off. No turn-off form.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-04 · Show password  `P3` `UI`

**Steps**

1. On sign-in, sign-up and Change password click the eye icon.

**Expected:** The password becomes visible and hides again.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-05 · Change password  `P2` `Security`

**Steps**

1. Account → Password → change it.

**Expected:** Saved. Other sessions of that account are signed out; the current one stays.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-06 · Sessions list  `P2` `Security`

**Steps**

1. Account → Sessions: sign in from a second browser, then “Sign out other sessions”.

**Expected:** Both sessions listed with browser and IP; the other browser is signed out on its next action.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-07 · Session ends after 30 idle days  `P3` `Security`

**Steps**

1. (Optional, needs database access) Ask the developer to age a session past 30 days, then use it.

**Expected:** You are sent to the sign-in page. Activity within 30 days keeps you signed in.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-08 · Back after signing in  `P2` `UI`

**Steps**

1. Signed out, open a deep link (a base URL). Sign in.

**Expected:** After sign-in (and two-factor) you land on that base.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M02-09 · Google sign-in (if enabled)  `P3` `Security`

**Steps**

1. Click Sign in with Google with an invited Google account.

**Expected:** Signs in; two-factor is still required.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M03 — Sign-in security: wrong passwords and alerts

**Goal:** Five wrong passwords lock an account for 15 minutes; Owners are alerted with email and IP.

**Before you start:**

- Use the EDITOR account. Have OWNER signed in elsewhere to watch the bell.

### M03-01 · Attempts 1–2: no warning  `P2` `Security`

**Steps**

1. Enter a wrong password twice for EDITOR.

**Expected:** Plain “Incorrect email or password”.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M03-02 · Attempts 3–4: warning  `P1` `Security`

**Steps**

1. Enter a wrong password a 3rd and 4th time.

**Expected:** A warning with attempts left (e.g. “2 attempts left”).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M03-03 · Attempt 5: locked 15 minutes  `P1` `Security`

**Steps**

1. Enter a wrong password a 5th time, then the right one.

**Expected:** Account locked with a countdown; the right password is refused while locked.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M03-04 · Owner alerts  `P1` `Security`

**Steps**

1. Check OWNER’s bell and email.

**Expected:** One alert per wrong attempt with the email tried, IP, browser, time and “Wrong password n of 5”, plus a lock alert.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M03-05 · Owner is never locked  `P2` `Security`

**Steps**

1. Enter OWNER’s password wrong 6 times (in a private window).

**Expected:** OWNER is not locked (the general rate limit of 10 tries per 15 minutes per IP still applies).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M03-06 · Unlock after 15 minutes  `P2` `Security`

**Steps**

1. Wait 15 minutes, sign in as EDITOR with the right password.

**Expected:** Works and resets the count.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M04 — Account types: Owner, Admin, Member

**Goal:** Only Owners change account types; several Owners; transfer; at least one Owner always remains.

### M04-01 · Account types offered  `P1` `UI`

**Steps**

1. As OWNER open Members & access → People → Invite.

**Expected:** Account type list is exactly Member, Admin, Owner.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-02 · Owner changes an account type  `P1` `UI`

**Steps**

1. Change EDITOR to Admin and back to Member with the Account type select.

**Expected:** Confirmation, then the badge changes; Activity log records it.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-03 · Admin can't change account types  `P1` `Security`

**Steps**

1. As ADMIN open People.

**Expected:** No Account type selects and no Transfer ownership.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-04 · Second Owner  `P1` `Security`

**Steps**

1. Invite OWNER2 as Owner; accept.

**Expected:** OWNER2 sees every workspace and base, and Members & access.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-05 · Owner steps down (two Owners)  `P2` `UI`

**Steps**

1. As OWNER2 set your own account type to Admin.

**Expected:** Allowed while another active Owner exists.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-06 · Last Owner can't step down  `P1` `Security`

**Steps**

1. With a single Owner, try to make yourself Admin.

**Expected:** Refused: the organization needs at least one Owner.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-07 · Transfer ownership  `P2` `UI`

**Steps**

1. As OWNER click Transfer ownership on OWNER2 (or a Member) and confirm.

**Expected:** They become Owner and you become Admin. (Restore afterwards.)

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-08 · Admin data access is only what is given  `P1` `Security`

**Steps**

1. As ADMIN (Creator on WS-A only) open Home.

**Expected:** ADMIN opens WS-A’s bases but not WS-B’s; WS-B is listed by name (rename/delete only).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M04-09 · Billing is Owner-only  `P3` `Security`

**Steps**

1. As ADMIN look for plan/billing options or call the billing endpoint.

**Expected:** Not available to Admins.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M05 — Members & access: invites, roles, end dates

**Goal:** One invite form everywhere; roles per workspace or base; Admins only within their reach.

### M05-01 · Invite to selected bases  `P1` `UI`

**Steps**

1. Invite with “Selected bases only”, tick two bases, role Editor.

**Expected:** The person sees exactly those two bases, as Editor.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-02 · Invite to a whole workspace  `P1` `UI`

**Steps**

1. Invite with “Workspace · WS-A (all its bases)”, role Viewer.

**Expected:** The person sees every base in WS-A, read-only.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-03 · Workspace Owner role  `P2` `Security`

**Steps**

1. Give CREATOR the Workspace Owner role on WS-B.
2. As CREATOR: rename WS-B, edit a base’s fields in WS-B, try Create a base in WS-B.

**Expected:** Rename (and delete) WS-B works and CREATOR is Creator on every base in it; creating bases still needs Owner or Admin.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-04 · Home Share uses the same form  `P2` `UI`

**Steps**

1. On Home click Share on WS-A.

**Expected:** The same invite form, starting with the whole workspace; the member list below.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-05 · Change a role  `P1` `Security`

**Steps**

1. Edit access → change a base role from Editor to Viewer.

**Expected:** The person can no longer edit (refresh their page).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-06 · Base role overrides workspace role  `P1` `Security`

**Steps**

1. VIEWER has Viewer on WS-A. Set BASE-1 to Editor for VIEWER, and another base to “No access to this base”.

**Expected:** VIEWER edits BASE-1, can't see the blocked base, still reads the others.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-07 · Access end date  `P2` `Security`

**Steps**

1. Set “Access until” to tomorrow on a grant.

**Expected:** Shown as time-limited; after the date the access disappears.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-08 · Bulk change  `P2` `UI`

**Steps**

1. Tick several rows in Edit access and Apply a role to selected.

**Expected:** All selected rows change.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-09 · Suspend and reactivate  `P1` `Security`

**Steps**

1. Suspend EDITOR, try to open BASE-1 as EDITOR, then reactivate.

**Expected:** Suspended: nothing opens. Reactivated: access back with the same roles.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-10 · Remove from organization  `P1` `Security`

**Steps**

1. Remove a test Member.

**Expected:** All their access and devices here are gone.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-11 · Admin manages Members within reach  `P1` `Security`

**Steps**

1. As ADMIN invite a Member to WS-A; change their role; suspend them.

**Expected:** All allowed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-12 · Admin limits  `P1` `Security`

**Steps**

1. As ADMIN try: invite to WS-B, give a role above Creator, change OWNER’s or another Admin’s access, change your own access, invite an Admin.

**Expected:** Each is refused with a clear message.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-13 · Admin sees only what they manage  `P1` `Security`

**Steps**

1. As ADMIN open Members & access.

**Expected:** Only WS-A (and its bases) appear in the invite form and access matrix.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-14 · Member can't open Members & access  `P1` `Security`

**Steps**

1. As EDITOR open the account menu → Members & access.

**Expected:** “Only Owners and Admins can manage access.”

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M05-15 · Pending invitations  `P2` `UI`

**Steps**

1. Check the invitations list; cancel one.

**Expected:** Listed with role and expiry; cancelled invitation link stops working.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M06 — Device approval

**Goal:** With device approval on, every non-Owner needs each browser approved.

**Before you start:**

- Security → Require device approval is on (default).

### M06-01 · New device waits  `P1` `Security`

**Steps**

1. Sign in as EDITOR in a new browser.

**Expected:** A “waiting for approval” banner; no data opens.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-02 · Owner/Admin notified  `P2` `UI`

**Steps**

1. Check OWNER’s and ADMIN’s bell.

**Expected:** “Device approval needed” with browser and IP.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-03 · Approve  `P1` `Security`

**Steps**

1. Members & access → Devices → Approve.

**Expected:** EDITOR’s page unlocks by itself.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-04 · Revoke and forget  `P2` `Security`

**Steps**

1. Revoke the device, then Forget it.

**Expected:** Revoked device is blocked again; forgotten device asks for approval next time.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-05 · Admin limits on devices  `P1` `Security`

**Steps**

1. As ADMIN try to approve your own device or OWNER’s.

**Expected:** Refused. ADMIN can approve Members’ devices.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-06 · Owner is exempt  `P2` `Security`

**Steps**

1. Sign in as OWNER in a new browser.

**Expected:** No approval needed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-07 · Device log  `P3` `UI`

**Steps**

1. Open Devices and expand a person.

**Expected:** Waiting/approved/revoked devices, active and ended sessions, history of approvals with who decided.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M06-08 · Turn approval off  `P2` `Security`

**Steps**

1. Security → untick Require device approval; sign in from a new browser as EDITOR.

**Expected:** No approval needed. Turn it back on afterwards.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M07 — Security settings and Activity log

**Goal:** Allowed sign-up domains and the audit trail.

### M07-01 · Add and remove allowed domains  `P1` `UI`

**Steps**

1. Security → add “@example.org”, then remove it.

**Expected:** Chip appears and disappears; invalid input like “not a domain” is refused.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M07-02 · Admins can change security  `P2` `Security`

**Steps**

1. As ADMIN change allowed domains.

**Expected:** Allowed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M07-03 · Activity log lists events  `P1` `UI`

**Steps**

1. Members & access → Activity.

**Expected:** Recent sign-ins, invitations, role changes, devices, tokens, moves… with who, what, when and IP.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M07-04 · Activity filter  `P2` `UI`

**Steps**

1. Choose each filter (Invitations, Devices…).

**Expected:** Only that kind of event is listed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M07-05 · Show older  `P3` `UI`

**Steps**

1. With more than 100 events, click Show older.

**Expected:** Older events load below.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M07-06 · Members can't see Activity  `P1` `Security`

**Steps**

1. As EDITOR try /admin?tab=activity.

**Expected:** Refused.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M08 — Workspaces

**Goal:** Only Owners and Admins create workspaces; rename and delete with a warning.

### M08-01 · Owner creates a workspace  `P1` `UI`

**Steps**

1. Home → + Create workspace.

**Expected:** Created and listed in the sidebar.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-02 · Members can't create workspaces  `P1` `Security`

**Steps**

1. As EDITOR look for + Create workspace.

**Expected:** Not shown; the API refuses it too.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-03 · Organization picker  `P3` `UI`

**Steps**

1. As an account that is Owner/Admin of two organizations, create a workspace.

**Expected:** The dialog asks which organization.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-04 · Rename workspace  `P2` `UI`

**Steps**

1. Workspace ⋯ → Rename.

**Expected:** Name changes everywhere.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-05 · Delete workspace with warning  `P1` `UI`

**Steps**

1. Workspace ⋯ → Delete workspace…
2. Try to confirm before typing the name, then type it and delete.

**Expected:** Delete stays disabled until the exact name is typed; then the workspace and its bases disappear for everyone.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-06 · Who can delete  `P1` `Security`

**Steps**

1. As EDITOR and as VIEWER open the workspace ⋯ menu.

**Expected:** No Delete or Rename for them.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-07 · Contacts directory  `P2` `UI`

**Steps**

1. Workspace ⋯ → Contacts: add, edit, search, delete a contact.

**Expected:** Works for people with a workspace role; base-only people don’t get Contacts.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M08-08 · Empty Home for people without access  `P3` `UI`

**Steps**

1. Sign in as DOMAIN (no access yet).

**Expected:** “Nothing has been shared with you yet” with an explanation.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M09 — Bases

**Goal:** Create, rename, duplicate, move, delete and restore bases.

### M09-01 · Create a base  `P1` `UI`

**Steps**

1. In WS-A click Create a base → Start from scratch.

**Expected:** Opens with Table 1, a default Grid view and 3 empty rows.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-02 · Create from a CSV  `P2` `UI`

**Steps**

1. Create a base → Import a CSV.

**Expected:** Base created with the file’s columns and rows.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-03 · Rename a base  `P2` `UI`

**Steps**

1. Base ⋯ (Home card or base title menu) → Rename.

**Expected:** Name updated in Home, title and search.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-04 · Duplicate a base (Owner/Admin)  `P1` `UI`

**Steps**

1. Base card ⋯ → Duplicate.

**Expected:** A copy with tables, fields, views and records appears in the same workspace.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-05 · Members can't duplicate  `P1` `Security`

**Steps**

1. As CREATOR look for Duplicate.

**Expected:** Not shown; API refuses.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-06 · Move to another workspace  `P1` `UI`

**Steps**

1. Base card ⋯ → Move to workspace… → WS-B.

**Expected:** Base listed in WS-B with all data, automations and share links working; people who had access only through WS-A lose it; base-level roles stay.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-07 · Move limits  `P2` `Security`

**Steps**

1. As CREATOR (not Owner/Admin/Workspace Owner of both) try to move.

**Expected:** Refused.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-08 · Delete a base  `P1` `UI`

**Steps**

1. Base ⋯ → Delete → confirm.

**Expected:** Removed for everyone.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M09-09 · Base IDs  `P3` `UI`

**Steps**

1. Table tab menu → IDs & API…

**Expected:** Shows bas_… and tbl_… IDs with copy buttons.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M10 — Tables

**Goal:** Add, rename, duplicate, hide, delete and restore tables.

### M10-01 · Add a blank table  `P1` `UI`

**Steps**

1. + next to the table tabs → Blank table.

**Expected:** New tab with a default Grid view.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M10-02 · Rename, duplicate, hide  `P2` `UI`

**Steps**

1. Table tab menu → Rename / Duplicate / Hide.

**Expected:** Each works; hidden tables can be shown again.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M10-03 · Reorder tables  `P3` `UI`

**Steps**

1. Drag a table tab.

**Expected:** Order is kept after refresh.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M10-04 · Delete and restore  `P1` `Data`

**Steps**

1. Delete a table, then Tools → Trash → restore.

**Expected:** Table and data come back.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M10-05 · Table limit  `P3` `Limit`

**Steps**

1. (Free plan: 50 tables per base.) Create tables until refused, or ask the developer to check.

**Expected:** A clear plan-limit message at the limit.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M10-06 · Viewer can't change tables  `P1` `Security`

**Steps**

1. As VIEWER open the table tab menu.

**Expected:** No create/rename/delete.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M11 — Fields and field types

**Goal:** Every field type stores, shows and converts values correctly.

**Before you start:**

- Use a scratch table in BASE-1. For each type: create the field, enter 3 values (normal, empty, edge), refresh, then convert to Single line text and back where it makes sense.

### M11-01 · Single line text and Long text  `P1` `UI`

**Steps**

1. Create both; type short, empty and very long (2,000+ chars) values; multi-line in Long text.

**Expected:** Values saved; long text wraps in tall rows and the expanded record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-02 · Number, Currency, Percent  `P1` `UI`

**Steps**

1. Set decimals, currency symbol; enter 0, negative, large and decimal values.

**Expected:** Shown with the chosen format; invalid text refused or converted.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-03 · Duration and Rating  `P2` `UI`

**Steps**

1. Enter 1:30 in Duration; set Rating by click and keys 1–9.

**Expected:** Stored and shown correctly.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-04 · Checkbox  `P2` `UI`

**Steps**

1. Toggle by click and Enter.

**Expected:** Toggles; counts in summaries.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-05 · Single and Multiple select  `P1` `UI`

**Steps**

1. Add options with colors, rename an option, delete one, pick values, type a new option.

**Expected:** Options and colors kept; renaming updates every record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-06 · User (collaborator)  `P2` `UI`

**Steps**

1. Assign collaborators; allow multiple on/off.

**Expected:** Only base collaborators listed; avatars shown.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-07 · Date and Date and time  `P1` `UI`

**Steps**

1. Set formats and time zone; enter dates via picker and typing.

**Expected:** Shown in the chosen format and time zone; sorting by date works.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-08 · Email, URL, Phone  `P2` `UI`

**Steps**

1. Enter valid and invalid values; click the links.

**Expected:** Valid ones become links (mailto:, tel:, web); invalid ones are flagged/refused.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-09 · Attachment  `P1` `UI`

**Steps**

1. Upload images and a PDF (see M21).

**Expected:** Thumbnails in the cell; preview and download work.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-10 · Link to another record  `P1` `UI`

**Steps**

1. Link Deals → Companies; allow multiple off/on (see M16).

**Expected:** Chips shown; the other table gets a matching link field.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-11 · Barcode, Button, JSON  `P3` `UI`

**Steps**

1. Enter a barcode value; configure a Button with a URL and click it; enter valid and invalid JSON.

**Expected:** Barcode stored; button opens the URL; invalid JSON refused.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-12 · Formula, Lookup, Rollup, Count  `P1` `UI`

**Steps**

1. Create each (see M16, M17).

**Expected:** Read-only computed values that update when inputs change.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-13 · Autonumber, Record ID, Created/modified time, Created/modified by  `P2` `UI`

**Steps**

1. Add each; create and edit records.

**Expected:** Filled automatically, read-only; modified fields update on edit.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-14 · Primary field  `P2` `UI`

**Steps**

1. Try to hide/delete the primary field; Set as primary on another field.

**Expected:** Primary can't be hidden or deleted; another field can become primary.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-15 · Change field type  `P1` `Data`

**Steps**

1. Convert number → text → number, text → single select, date → text.

**Expected:** Values converted where possible; Ctrl+Z undoes the change.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-16 · Field description and menu  `P2` `UI`

**Steps**

1. Add a description; use header ▾: duplicate, insert left/right, sort, filter, group, freeze, hide.

**Expected:** Description shows as a tooltip; each menu action works.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-17 · Reorder and resize columns  `P3` `UI`

**Steps**

1. Drag a header; drag its edge.

**Expected:** Kept after refresh (per view).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-18 · Field permissions  `P1` `Security`

**Steps**

1. Field ▾ → Edit permissions → Creators and up; then Specific users; then Nobody but Creators and Owners. Test with EDITOR and CREATOR.

**Expected:** EDITOR is blocked as configured; Owners and Creators can always edit.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M11-19 · Delete a field and restore  `P1` `Data`

**Steps**

1. Delete a field, then restore it from Trash.

**Expected:** Field and its values come back.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M12 — Editing records in the grid

**Goal:** Fast, correct editing with mouse and keyboard.

### M12-01 · Type into cells  `P1` `UI`

**Steps**

1. Click a cell and type; press Enter to edit; Esc to cancel.

**Expected:** Values saved; Esc restores the old value.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-02 · Keyboard navigation  `P2` `UI`

**Steps**

1. Use arrows, Ctrl+arrows, Tab/Shift+Tab, Enter, Space (expand), Shift+Space (select row), Delete (clear).

**Expected:** Each shortcut does what Help → Keyboard shortcuts says.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-03 · Copy and paste  `P1` `UI`

**Steps**

1. Copy a range in TableOS and paste elsewhere; paste a range from Excel/Google Sheets.

**Expected:** Values pasted into the right cells with type conversion.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-04 · Fill handle  `P2` `UI`

**Steps**

1. Select a cell and drag the fill handle down.

**Expected:** Values copied down.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-05 · Add, insert, duplicate, delete rows  `P1` `UI`

**Steps**

1. + row at the bottom; right-click a row → insert above/below, duplicate, delete.

**Expected:** Each works; deleted rows can be restored from Trash.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-06 · Multi-select actions  `P2` `UI`

**Steps**

1. Tick several row checkboxes; delete them.

**Expected:** All selected rows deleted (and restorable).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-07 · Expanded record  `P1` `UI`

**Steps**

1. Open a record (⤢ or Space); edit hidden fields; move with ↑/↓ or K/J; copy record URL; Esc.

**Expected:** Everything editable; URL contains rec_…; navigation works.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-08 · Record URL  `P2` `UI`

**Steps**

1. Copy a record URL, open it in another tab.

**Expected:** Opens the same table, view and record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-09 · Viewer and Commenter can't edit  `P1` `Security`

**Steps**

1. As VIEWER and COMMENTER try to edit cells, add/delete rows.

**Expected:** Not possible in the UI; API refuses.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M12-10 · Large table scrolling  `P2` `Limit`

**Steps**

1. Open a table with 5,000+ rows (after CSV-L import) and scroll.

**Expected:** Smooth; rows load as you scroll; row count in the footer is right.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M13 — Comments, mentions and history

**Goal:** Discuss records and see who changed what.

### M13-01 · Comment on a record  `P1` `UI`

**Steps**

1. Expanded record → write a comment.

**Expected:** Comment shown with author and time.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M13-02 · @mention  `P1` `UI`

**Steps**

1. Mention EDITOR in a comment.

**Expected:** EDITOR gets a bell notification that opens the record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M13-03 · Edit and delete own comment  `P2` `Security`

**Steps**

1. Edit then delete your comment.

**Expected:** Allowed for your own; others’ comments can’t be changed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M13-04 · Commenter can comment  `P1` `Security`

**Steps**

1. As COMMENTER comment on a record.

**Expected:** Allowed; editing cells is not.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M13-05 · Revision history  `P1` `UI`

**Steps**

1. Change several fields; open the record’s history; group by person / by field.

**Expected:** Every change listed with old → new value, who and when.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M13-06 · Activity filters  `P3` `UI`

**Steps**

1. Use the record activity filter (all activity, revision history, comments, resolved).

**Expected:** Lists filter correctly.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M14 — Undo, redo and trash

**Goal:** Mistakes can be reversed.

### M14-01 · Undo/redo cell edits  `P1` `UI`

**Steps**

1. Edit cells, press Ctrl+Z several times, then Ctrl+Shift+Z / Ctrl+Y.

**Expected:** Edits undone and redone in order.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M14-02 · Undo a deletion  `P1` `Data`

**Steps**

1. Delete rows, press Ctrl+Z.

**Expected:** Rows come back with their values and links.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M14-03 · Undo a field type change  `P2` `Data`

**Steps**

1. Change a field type, press Ctrl+Z.

**Expected:** Type and values restored.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M14-04 · Trash  `P1` `Data`

**Steps**

1. Tools → Trash: restore a deleted record, field and table.

**Expected:** Each restored.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M15 — Views

**Goal:** Every view type and the view toolbar; the default Grid view can never be deleted.

### M15-01 · Default Grid view  `P1` `Security`

**Steps**

1. On any table open the default Grid view’s ⋯ menu.

**Expected:** No “Delete view” and no “Make personal”; a note “Default view: every table keeps it.” Rename still works.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-02 · Grid view  `P1` `UI`

**Steps**

1. Create a collaborative Grid view.

**Expected:** Works like the default grid.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-03 · Gallery view  `P2` `UI`

**Steps**

1. Create a Gallery with an attachment as cover.

**Expected:** Cards with covers; click opens the record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-04 · Kanban view  `P1` `UI`

**Steps**

1. Kanban by a single select (and by a user field); drag cards between columns.

**Expected:** Dragging changes the field value.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-05 · Calendar view  `P2` `UI`

**Steps**

1. Calendar on a date field; drag a record to another day.

**Expected:** Records on their dates; dragging changes the date.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-06 · Timeline and Gantt  `P2` `UI`

**Steps**

1. Set start and end dates; drag/resize bars.

**Expected:** Bars match the dates; changes saved.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-07 · List view  `P3` `UI`

**Steps**

1. Create a List view.

**Expected:** Compact readable list.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-08 · Form view  `P1` `UI`

**Steps**

1. Create a Form view (see M22).

**Expected:** Form editor opens.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-09 · Hide fields  `P1` `UI`

**Steps**

1. Hide and show fields; drag their order.

**Expected:** Only this view changes.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-10 · Filter  `P1` `UI`

**Steps**

1. Add conditions for text, number, date, select, checkbox, empty/not empty; nest an OR group.

**Expected:** Only matching records shown; the filter is saved with the view.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-11 · Sort and group  `P1` `UI`

**Steps**

1. Sort by two fields; group by up to three fields with group summaries.

**Expected:** Correct order and groups.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-12 · Color and row height  `P3` `UI`

**Steps**

1. Color rows by a select field and by conditions; change row height.

**Expected:** Applied and saved.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-13 · Search in view  `P2` `UI`

**Steps**

1. Use 🔍 in the toolbar.

**Expected:** Matches highlighted; moves between matches.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-14 · Summary footer  `P2` `UI`

**Steps**

1. Choose count, sum, average, min, max, filled, empty per column.

**Expected:** Correct numbers for the visible records.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-15 · Personal, collaborative, locked views  `P2` `Security`

**Steps**

1. Create a personal view (only you see it); lock a collaborative view; try editing it as EDITOR.

**Expected:** Personal views are private; locked views can’t be changed except by their creator/base Creators.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-16 · Favorites, duplicate, rename, delete  `P2` `UI`

**Steps**

1. Favorite a view; duplicate; rename; delete a non-default view.

**Expected:** Each works; favorites appear in My favorites.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-17 · Views sidebar  `P3` `UI`

**Steps**

1. Hide the views list with ☰ and show it again; refresh.

**Expected:** Choice remembered.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M15-18 · View URL  `P3` `UI`

**Steps**

1. Copy the URL of a view and open it in a new tab.

**Expected:** Opens the same view.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M16 — Links, lookups, rollups and counts

**Goal:** Relationships between tables, including across bases.

### M16-01 · Create a link  `P1` `UI`

**Steps**

1. Deals: Link to Companies. Pick records; type to search.

**Expected:** Chips in Deals; Companies gets a matching link field showing the deals.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M16-02 · Single vs multiple  `P2` `UI`

**Steps**

1. Turn off “allow multiple” and try to add a second record.

**Expected:** Only one allowed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M16-03 · Lookup  `P1` `Data`

**Steps**

1. Companies → lookup Deals.Amount.

**Expected:** Shows the linked values; updates when Deals change.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M16-04 · Rollup  `P1` `Data`

**Steps**

1. Companies → rollup SUM(Deals.Amount), then AVERAGE, MAX, COUNT, ARRAYJOIN.

**Expected:** Correct results; update live.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M16-05 · Count  `P2` `Data`

**Steps**

1. Companies → count of Deals.

**Expected:** Correct counts.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M16-06 · Unlinking and deleting  `P1` `Data`

**Steps**

1. Remove a link chip; delete a linked record.

**Expected:** Lookups/rollups/counts update; no orphan errors.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M16-07 · Link to another base  `P2` `UI`

**Steps**

1. Create a link field → + Link to a table in another base → BASE-2.

**Expected:** A synced copy of that table is added and linked; lookups work.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M17 — Formulas

**Goal:** Formula fields compute correctly and report errors clearly.

### M17-01 · Arithmetic and text  `P1` `Data`

**Steps**

1. {Price} * {Quantity}; {First} & " " & {Last}; UPPER/LOWER/LEFT/MID.

**Expected:** Correct values.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-02 · Logic  `P1` `Data`

**Steps**

1. IF, SWITCH, AND/OR, ISBLANK, IFERROR.

**Expected:** Correct values.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-03 · Dates  `P1` `Data`

**Steps**

1. DATEADD, DATETIME_DIFF, DATETIME_FORMAT, TODAY, NOW, WORKDAY, IS_BEFORE, SET_TIMEZONE.

**Expected:** Correct values in the base time zone.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-04 · Lists and regex  `P2` `Data`

**Steps**

1. ARRAYJOIN/ARRAYUNIQUE on a lookup; REGEX_MATCH/EXTRACT/REPLACE.

**Expected:** Correct values.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-05 · Record functions  `P2` `Data`

**Steps**

1. RECORD_ID(), CREATED_TIME(), ROW_NUMBER(), CREATED_BY().

**Expected:** Correct values.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-06 · Editor help  `P3` `UI`

**Steps**

1. Type in the formula editor.

**Expected:** Field and function suggestions appear.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-07 · Errors  `P2` `UI`

**Steps**

1. Write an invalid formula (unknown field, wrong arguments, division by zero).

**Expected:** Clear error message; the field isn’t saved broken / shows #ERROR in cells as designed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M17-08 · Updates  `P1` `Realtime`

**Steps**

1. Change an input field.

**Expected:** Formula value updates immediately (and for other users live).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M18 — Synced tables from another base

**Goal:** Read-only copies that stay up to date.

### M18-01 · Add a synced table  `P1` `UI`

**Steps**

1. + → Sync from another base → pick BASE-2’s table.

**Expected:** Table with ⇄ badge, fields and records copied.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-02 · Changes flow  `P1` `Data`

**Steps**

1. Edit/add/delete in the source; wait a few seconds.

**Expected:** Changes appear in the synced table (full check also every ~5 minutes).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-03 · Schema changes flow  `P2` `Data`

**Steps**

1. Rename, add and delete a field in the source.

**Expected:** Reflected in the synced table.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-04 · Read-only  `P1` `Security`

**Steps**

1. Try to edit or add records in the synced table.

**Expected:** Not allowed; your own extra fields stay editable.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-05 · Sync bar controls  `P2` `UI`

**Steps**

1. Sync now, Stop, Pause, Resume.

**Expected:** Progress shown; each control works.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-06 · Values that don’t fit  `P2` `Data`

**Steps**

1. Put an invalid phone in a source field mapped to Phone; sync.

**Expected:** Rest syncs; “values couldn’t be synced — review” lets you keep as text or leave empty.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-07 · Stop syncing  `P2` `UI`

**Steps**

1. Tab menu → Stop syncing.

**Expected:** Becomes a normal editable table.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M18-08 · Access of the creator  `P3` `Security`

**Steps**

1. Remove the sync creator’s access to the source base.

**Expected:** Sync stops with an error until someone with access sets it up again.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M19 — Connectors: Airtable, HubSpot, Gmail, Slack

**Goal:** External data and messaging.

**Before you start:**

- Needs real accounts/tokens for each service. Skip (mark N/A) any service you don’t use.

### M19-01 · Connect Airtable  `P2` `UI`

**Steps**

1. Account menu → Connectors → Airtable → paste a personal access token.

**Expected:** Connected; listed under Connectors.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M19-02 · Sync from Airtable  `P2` `Data`

**Steps**

1. + → Sync from Airtable → base, table, fields.

**Expected:** Records and fields arrive; linked records show names; attachments show names/links.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M19-03 · Connect HubSpot and sync  `P2` `Data`

**Steps**

1. Connect a private-app token; Sync from HubSpot → contacts with chosen properties.

**Expected:** Records arrive with types kept; refresh every 15 minutes; Sync now works.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M19-04 · HubSpot two-way  `P3` `Data`

**Steps**

1. Tick Two-way; edit a synced field.

**Expected:** The change appears in HubSpot within seconds; rejected values explained on the bar.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M19-05 · Gmail  `P3` `Data`

**Steps**

1. Sign in with Google; Sync from Gmail with in:inbox; automation step Send email via Gmail.

**Expected:** Messages arrive in a table; the email is sent from your address.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M19-06 · Slack  `P3` `Data`

**Steps**

1. Connect a bot token in the Send Slack message step; run the automation.

**Expected:** Message posted in the channel.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M19-07 · Disconnect  `P3` `UI`

**Steps**

1. Remove a connection.

**Expected:** Removed; syncs using it show an error instead of silently failing.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M20 — Import and export

**Goal:** Files in and out; export is for Owners and Admins only.

### M20-01 · Import CSV as a new table  `P1` `Data`

**Steps**

1. + → Import a file → CSV-S; check suggested types; import.

**Expected:** Table created with the right types and 20 rows.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-02 · Import Excel  `P2` `Data`

**Steps**

1. Import XLSX; pick the second sheet.

**Expected:** That sheet imported.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-03 · Import TSV/TXT  `P3` `Data`

**Steps**

1. Import a .tsv and .txt file.

**Expected:** Imported correctly.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-04 · Import into an existing table  `P1` `Data`

**Steps**

1. Table menu → Import into the table; check column matching, + New field, Import all / Don’t import any.

**Expected:** Columns matched by name; new fields created where chosen.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-05 · Large import in the background  `P1` `Limit`

**Steps**

1. Import CSV-L.

**Expected:** Progress shown; you can keep working; all rows arrive.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-06 · Stop an import  `P2` `UI`

**Steps**

1. Start CSV-L and press Stop.

**Expected:** Stops at once with a summary.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-07 · Invalid entries  `P1` `Data`

**Steps**

1. Import CSV-BAD.

**Expected:** Invalid values listed per row; fix them, import them empty or skip them.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-08 · Name clashes  `P3` `UI`

**Steps**

1. Import a file whose table name already exists.

**Expected:** A sensible new name or a prompt.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-09 · Export CSV/Excel/JSON  `P1` `Data`

**Steps**

1. As OWNER: Tools → Export CSV (or view menu Download) as CSV, Excel and JSON.

**Expected:** Only visible fields and filtered records, in view order.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M20-10 · Members can't export  `P1` `Security`

**Steps**

1. As CREATOR and EDITOR look for Export / Download.

**Expected:** Not shown; API refuses (copy and paste in the grid still works).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M21 — Attachments

**Goal:** Upload, preview, download, limits.

### M21-01 · Upload in a cell  `P1` `UI`

**Steps**

1. Drop images and a PDF into an Attachment cell.

**Expected:** Uploads with progress; thumbnails shown.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M21-02 · Preview and download  `P1` `UI`

**Steps**

1. Open the expanded attachment view; download a file.

**Expected:** Preview for images/PDF; download saves the original file.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M21-03 · Remove and reorder  `P2` `UI`

**Steps**

1. Remove one attachment; reorder.

**Expected:** Saved.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M21-04 · File size limit  `P2` `Limit`

**Steps**

1. Upload a file over 100 MB.

**Expected:** Refused with a clear message (per-file limit 100 MB; base limit 1 GB on the Free plan).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M21-05 · Attachments in share links  `P2` `Security`

**Steps**

1. See M25 (allow copy off).

**Expected:** No download links when copy is off.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M22 — Forms

**Goal:** Collect records from anyone with the link.

### M22-01 · Build a form  `P1` `UI`

**Steps**

1. Create a Form view; choose fields, mark required ones, add help text.

**Expected:** Saved.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M22-02 · Share and submit  `P1` `Data`

**Steps**

1. Share the form link; submit it signed out.

**Expected:** A new record is created with the values.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M22-03 · Required fields and validation  `P1` `Data`

**Steps**

1. Submit with a required field empty or an invalid email.

**Expected:** Refused with a message.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M22-04 · Attachments in a form  `P2` `Data`

**Steps**

1. Upload a file in the form.

**Expected:** File attached to the new record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M22-05 · Form-submitted automation  `P2` `Data`

**Steps**

1. See M24 trigger “When a form is submitted”.

**Expected:** Automation runs.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M23 — Interfaces

**Goal:** Dashboards and app pages on top of the data.

### M23-01 · Create an interface  `P1` `UI`

**Steps**

1. Base → Interfaces → create one.

**Expected:** Designer opens.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M23-02 · Each element  `P1` `UI`

**Steps**

1. Add Number, Chart, Date filter, Grid, List, Gallery, Record details, Form, Button, Text, Divider; connect each to a table/view.

**Expected:** Each element renders the right data.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M23-03 · Charts  `P2` `Data`

**Steps**

1. Bar, horizontal bar, line, area, pie, donut; group dates by day/week/month/quarter/year; up to four values; sort; limit; labels and legend.

**Expected:** Correct totals; empty periods shown as zero.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M23-04 · Date filter  `P2` `Data`

**Steps**

1. Add a Date filter; try each period and a custom range.

**Expected:** Every element using the same table follows the filter.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M23-05 · Record details and Form  `P2` `UI`

**Steps**

1. Select a record in a List; Record details shows it; submit the Form element.

**Expected:** Correct record; new record created.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M23-06 · Publish/view as others  `P2` `Security`

**Steps**

1. Open the interface as EDITOR and VIEWER.

**Expected:** They see the page according to their role.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M24 — Automations

**Goal:** Triggers, actions, tests, run history, Runs as and limits.

### M24-01 · Record created → Update record  `P1` `Data`

**Steps**

1. Create the automation, turn it on, add a record.

**Expected:** Runs and updates the record; run history shows success.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-02 · Record updated (specific fields)  `P1` `Data`

**Steps**

1. Trigger on one field; edit that field and another.

**Expected:** Runs only for the chosen field.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-03 · Record matches conditions / enters a view  `P2` `Data`

**Steps**

1. Set conditions; change a record to match.

**Expected:** Runs once when it starts matching.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-04 · Form submitted  `P2` `Data`

**Steps**

1. Trigger on a form; submit it.

**Expected:** Runs.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-05 · Scheduled  `P2` `Data`

**Steps**

1. Every N minutes / daily at a time.

**Expected:** Runs on time (check run history).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-06 · Button clicked  `P2` `Data`

**Steps**

1. Button field with Run automation; click it.

**Expected:** Runs for that record.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-07 · Webhook received  `P2` `API`

**Steps**

1. Copy the webhook URL; POST JSON to it (e.g. with curl or Postman).

**Expected:** Runs with the payload available as tokens; too many calls in a burst return 429.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-08 · Actions  `P1` `Data`

**Steps**

1. Use each: Update, Create, Find, Delete record; In-app notification; Send email; Send webhook; Conditional group.

**Expected:** Each action does what it says; tokens {} filled from the trigger.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-09 · Run a script  `P2` `Limit`

**Steps**

1. Script using input.config(), base.findRecords, base.updateRecord, fetch to a public URL, output.set.

**Expected:** Works; limits: 30 s total, 2 s CPU, 20 fetches, 100 calls per run; errors shown in history.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-10 · Test and run history  `P1` `UI`

**Steps**

1. Use Test with a chosen record; open run history and a failed run.

**Expected:** Step-by-step results and clear error messages.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-11 · Runs as  `P2` `Security`

**Steps**

1. Header “Runs as …”: as a Creator pick another Creator; try an Editor.

**Expected:** Saved for Creators; refused for Editors; editing no longer changes it.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-12 · Permissions  `P1` `Security`

**Steps**

1. As EDITOR open Automations.

**Expected:** Can view, can’t create or edit (Creators only).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-13 · Loops are stopped  `P2` `Limit`

**Steps**

1. Make automation A update a record that triggers B that triggers A.

**Expected:** Stops after the chain limit (8) without running forever.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-14 · Limit per base  `P3` `Limit`

**Steps**

1. (150 automations per base.)

**Expected:** A plan-limit message at the limit (optional to test).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M24-15 · Duplicate, rename, delete, turn off  `P2` `UI`

**Steps**

1. Use the automation ⋯ menu.

**Expected:** Each works; turned-off automations don’t run.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M25 — Public share links

**Goal:** Read-only links for people outside TableOS, Creators and up only.

### M25-01 · Creator creates a view link  `P1` `UI`

**Steps**

1. As CREATOR: Share view → Create shareable link.

**Expected:** Link created; opens signed out in a private window.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-02 · Editor can’t create or change links  `P1` `Security`

**Steps**

1. As EDITOR open Share view.

**Expected:** Message “Only Creators and Owners…”; controls disabled.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-03 · Shared page content  `P1` `Security`

**Steps**

1. Open the link signed out.

**Expected:** Only the view’s visible fields and filtered records; search and sort work; table tabs for base links.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-04 · Allow copy off (default)  `P1` `Security`

**Steps**

1. On the shared page try copy, cut, right-click, drag; check attachments; load more records.

**Expected:** Copy/cut/right-click/drag blocked; attachments have no download; records load 50 at a time.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-05 · Allow copy on  `P2` `UI`

**Steps**

1. Turn on Allow copying data; reload the page.

**Expected:** Copying works; attachments downloadable.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-06 · Password  `P1` `Security`

**Steps**

1. Add a password; open the link; wrong password 5 times.

**Expected:** Password asked; warnings on attempts 3–4; locked 15 minutes on the 5th; Owner alerted.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-07 · Expiry  `P2` `Security`

**Steps**

1. Set an expiry a few minutes ahead; wait.

**Expected:** Link stops working after it.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-08 · Generate new link / Disable  `P1` `Security`

**Steps**

1. Generate a new link, then Disable.

**Expected:** Old link stops at once; disabled link shows not found.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M25-09 · Share entire base  `P2` `UI`

**Steps**

1. Share view → Entire base.

**Expected:** All tables readable via the link.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M26 — Search, notifications and contacts

**Goal:** Find things and stay informed.

### M26-01 · Search palette  `P1` `UI`

**Steps**

1. Ctrl+K: search a base, a table, a record value.

**Expected:** Results grouped; Enter opens the right place; only things you can open are listed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M26-02 · Search after moving a base  `P3` `Data`

**Steps**

1. Move a base (M09) then search its records.

**Expected:** Still found.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M26-03 · Notification bell  `P1` `UI`

**Steps**

1. Trigger a mention, a comment on your record, an automation notification.

**Expected:** Each appears with unread count; clicking opens the record; mark read/unread; mark all read.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M26-04 · Desktop notifications  `P3` `UI`

**Steps**

1. Allow browser notifications when asked.

**Expected:** New notifications pop up on the desktop.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M26-05 · Hidden after losing access  `P2` `Security`

**Steps**

1. Notify EDITOR about BASE-1, then remove EDITOR’s access.

**Expected:** That notification disappears and isn’t counted.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M26-06 · Member emails are private  `P2` `Security`

**Steps**

1. As EDITOR open Share/member lists and @mention list.

**Expected:** Names only (your own email visible); Owners/Admins/Workspace Owners see emails.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M27 — Live collaboration (realtime)

**Goal:** Changes appear for everyone without refreshing.

**Before you start:**

- Open BASE-1 as OWNER in one browser and as EDITOR (and ADMIN) in another, side by side.

### M27-01 · Live cell edits  `P1` `Realtime`

**Steps**

1. OWNER edits a cell.

**Expected:** EDITOR sees it within about a second, without refreshing. And the other way round.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M27-02 · Live rows  `P1` `Realtime`

**Steps**

1. Add and delete rows in one browser.

**Expected:** Appear/disappear in the other.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M27-03 · Live schema  `P2` `Realtime`

**Steps**

1. Add, rename, delete a field; create a view.

**Expected:** Other browser updates.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M27-04 · Presence  `P2` `Realtime`

**Steps**

1. Both open the same table.

**Expected:** Avatars of who is here at the top.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M27-05 · Same cell at once  `P2` `Realtime`

**Steps**

1. Both edit the same cell at the same time.

**Expected:** Last write wins without errors; both end with the same value.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M27-06 · Reconnect  `P2` `Realtime`

**Steps**

1. Turn Wi-Fi off for 30 seconds in one browser, make changes in the other, turn it on.

**Expected:** The first browser catches up automatically.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M27-07 · Different roles  `P2` `Realtime`

**Steps**

1. VIEWER watches while EDITOR edits.

**Expected:** VIEWER sees live changes but can’t edit.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M28 — API and access tokens

**Goal:** The public record API, token scopes and errors.

**Before you start:**

- Use curl, Postman or similar. Token from Members & access → API tokens. Base URL = the API address.

### M28-01 · Create a token  `P1` `API`

**Steps**

1. Create tokens: Read only; Read+Write; Read+Write+Delete; one limited to BASE-1; one with an expiry.

**Expected:** Token shown once; listed with types, bases, expiry.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-02 · List bases  `P1` `API`

**Steps**

1. GET /v1/api/bases with the token.

**Expected:** Only reachable bases with tables and IDs.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-03 · Schema  `P2` `API`

**Steps**

1. GET /v1/bases/{baseId} and GET /v1/tables/{tableId}.

**Expected:** Tables and fields.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-04 · Query records  `P1` `API`

**Steps**

1. POST …/records/query with pageSize, sort, filter (eq, contains, gt, empty, and/or), search, fields, viewId; follow nextCursor.

**Expected:** Correct records and paging; nextCursor null on the last page.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-05 · Read one record  `P2` `API`

**Steps**

1. GET …/records/{recordId}?fields=fld_a,fld_b.

**Expected:** That record with the asked fields.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-06 · Group  `P3` `API`

**Steps**

1. POST …/records/group.

**Expected:** Grouped counts/aggregates.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-07 · Create, update, delete  `P1` `API`

**Steps**

1. POST …/records; PATCH …/records/{id}; DELETE …/records/{id}; use field names and IDs; typecast true for a select option name.

**Expected:** Works; changes appear live in the UI and in record history as “via API”.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-08 · Batches of 500  `P1` `Limit`

**Steps**

1. POST …/records/batch with 500 records, then 501; PATCH …/records/batch; POST …/records/batch-delete.

**Expected:** 500 works; 501 refused with a clear error.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-09 · Token types enforced  `P1` `Security`

**Steps**

1. Use the Read-only token to create; the Write token to delete.

**Expected:** 403 with the missing type named.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-10 · Base limits enforced  `P1` `Security`

**Steps**

1. Use the BASE-1-only token on BASE-2.

**Expected:** 404/403.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-11 · Revoked/expired tokens  `P1` `Security`

**Steps**

1. Revoke a token and call the API; wait for an expired one.

**Expected:** 401 immediately.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-12 · Admin tokens  `P1` `Security`

**Steps**

1. As ADMIN create a token; read WS-B data with it.

**Expected:** Refused: an Admin’s token only reaches what the Admin was given. Admin sees only their own tokens.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-13 · Non-record APIs refused  `P2` `Security`

**Steps**

1. Call e.g. /v1/workspaces with a token.

**Expected:** 403 “API tokens can only call the record API”.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-14 · Synced tables are read-only  `P2` `API`

**Steps**

1. Write to a synced table via API.

**Expected:** 403.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-15 · Errors  `P2` `API`

**Steps**

1. Send invalid JSON, an unknown field, a stale version, a missing token.

**Expected:** 400/422 listing the problem; 409 for version conflicts; 401 without token.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-16 · Version  `P3` `API`

**Steps**

1. GET /v1/version without a token; check the x-tableos-version header on any response.

**Expected:** Both show the running version.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M28-17 · Rate per token  `P2` `Limit`

**Steps**

1. Send 30 requests in one second with one token (plan: Free 5/s, Team 20/s).

**Expected:** Record what happens (429 with retry-after, or all succeed). Report either way.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M29 — Limits and performance

**Goal:** TableOS behaves well at its limits and with real amounts of data.

### M29-01 · Sign-in rate limit  `P2` `Limit`

**Steps**

1. From one IP try 11 wrong sign-ins for an Owner within 15 minutes.

**Expected:** 429 “Too many attempts” after 10.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M29-02 · Sign-up rate limit  `P3` `Limit`

**Steps**

1. (Production: 30 sign-ups per IP per hour.)

**Expected:** 429 after the limit (optional).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M29-03 · Import request size  `P2` `Limit`

**Steps**

1. Import a file with 2,000+ rows.

**Expected:** Sent in chunks; all rows imported.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M29-04 · Big base  `P1` `Limit`

**Steps**

1. A table with 30,000 records and 30 fields: scroll, filter, sort, group, search.

**Expected:** Usable (record times; anything over ~3 s is worth reporting).

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M29-05 · Many people at once  `P2` `Limit`

**Steps**

1. 5+ people edit the same base for 10 minutes.

**Expected:** No lost edits, no errors, realtime keeps up.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M29-06 · Text and name lengths  `P3` `Limit`

**Steps**

1. Names over 200 characters (workspace/base/automation), comments over 10,000 characters.

**Expected:** Refused with a clear message.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M29-07 · Server stays healthy  `P2` `Limit`

**Steps**

1. During heavy use ask the developer to watch logs (no out-of-memory or Redis errors).

**Expected:** No errors.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M30 — Permission matrix spot checks

**Goal:** One pass through the roles to make sure each sees exactly what it should.

**Before you start:**

- For each row, sign in as that account and try the action in BASE-1 (and WS-B where noted).

### M30-01 · OWNER  `P1` `Security`

**Steps**

1. Open every workspace/base; Members & access; export; duplicate; move; delete.

**Expected:** Everything allowed.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-02 · ADMIN  `P1` `Security`

**Steps**

1. WS-A bases; WS-B bases; Members & access (Members only); billing.

**Expected:** WS-A yes; WS-B no data; Members yes; billing no.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-03 · CREATOR (base)  `P1` `Security`

**Steps**

1. Schema changes, automations, share links, interfaces; export; duplicate base.

**Expected:** Schema/automations/share/interfaces yes; export and duplicate no.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-04 · EDITOR (base)  `P1` `Security`

**Steps**

1. Edit records, shared views, import; fields/tables; share links; automations.

**Expected:** Records, views, import yes; fields/tables, share links, automations no.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-05 · COMMENTER (base)  `P1` `Security`

**Steps**

1. Comment; personal views; edit cells.

**Expected:** Comment and personal views yes; editing no.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-06 · VIEWER (workspace)  `P1` `Security`

**Steps**

1. Read every base in WS-A; edit; comment.

**Expected:** Read yes; edit/comment no.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-07 · DOMAIN (no access)  `P1` `Security`

**Steps**

1. Home; any base URL.

**Expected:** Nothing opens until given access.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M30-08 · Direct URLs and API  `P1` `Security`

**Steps**

1. Paste URLs of things you shouldn’t see; call the API with a session (browser dev tools) for forbidden actions.

**Expected:** 404/403 everywhere; no data leaks in responses.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## M31 — Help, UI and browsers

**Goal:** Everything is understandable and works across browsers and screen sizes.

### M31-01 · Help pages  `P3` `UI`

**Steps**

1. Open every Help topic; follow links between them.

**Expected:** Content matches what TableOS does; no broken links.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M31-02 · Release notes  `P3` `UI`

**Steps**

1. Help → Release notes.

**Expected:** Current version listed first.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M31-03 · Browsers  `P2` `UI`

**Steps**

1. Repeat a short smoke test (sign in, edit a cell, open a record, create a view) in Chrome, Edge, Firefox and Safari.

**Expected:** Works the same.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M31-04 · Small screens  `P3` `UI`

**Steps**

1. Use a 1366×768 laptop screen and a tablet/phone width.

**Expected:** Nothing important cut off; dialogs scroll.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M31-05 · Error messages  `P3` `UI`

**Steps**

1. Throughout testing, note any message that is unclear, technical or in the wrong place.

**Expected:** Messages are clear and say what to do.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

### M31-06 · Slow network  `P3` `UI`

**Steps**

1. Chrome dev tools → Network → Slow 3G; use the app.

**Expected:** Loading states shown; no duplicate actions.

**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low

**What happened / notes:**

> 

**Screenshots:** (paste or attach in the workbook)

---

## Other findings

Anything not covered above: what, where, steps, expected, actual, severity, screenshots.
