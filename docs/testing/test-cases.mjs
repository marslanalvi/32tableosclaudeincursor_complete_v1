// TableOS end-to-end test plan: the single source for the Markdown plan, the PDF and the
// interactive workbook (docs/testing/build-test-docs.mjs). Each case:
//   [title, steps[], expected, priority, kind]
// priority: P1 = must work (blocker if broken), P2 = important, P3 = polish.
// kind: UI, API, Security, Limit, Realtime, Data.

export const PLAN_VERSION = "2.0";
export const APP_VERSION = "0.16.7";

/** Accounts the plan refers to. Create them in module M00 before anything else. */
export const ACCOUNTS = [
  ["OWNER", "Owner", "ai.deptbcc@bluecascade.org (the account from the fresh start)"],
  ["OWNER2", "Second Owner", "A second Owner, invited by OWNER as Owner"],
  ["ADMIN", "Admin", "Invited by OWNER as Admin; give it Creator on workspace WS-A only"],
  ["CREATOR", "Member, base Creator", "Invited to base BASE-1 as Creator"],
  ["EDITOR", "Member, base Editor", "Invited to base BASE-1 as Editor"],
  ["COMMENTER", "Member, base Commenter", "Invited to base BASE-1 as Commenter"],
  ["VIEWER", "Member, workspace Viewer", "Invited to workspace WS-A as Viewer (all its bases)"],
  ["DOMAIN", "Member via allowed domain", "Signs up with an @bluecascade.org (or allowed) email without an invitation"],
  ["OUTSIDER", "No account", "An email that is not invited and not on an allowed domain"],
];

/** Test data the plan refers to. */
export const DATA = [
  ["WS-A", "Workspace “Sales” created by OWNER"],
  ["WS-B", "Workspace “Finance” created by OWNER"],
  ["BASE-1", "Base “CRM” in WS-A with tables Contacts, Companies, Deals"],
  ["BASE-2", "Base “Budget” in WS-B"],
  ["CSV-S", "A small CSV (20 rows, 6 columns: text, number, date, email, select-like, checkbox)"],
  ["CSV-L", "A large CSV (5,000+ rows) for background import"],
  ["XLSX", "An Excel file with two sheets"],
  ["CSV-BAD", "A CSV with invalid emails, phone numbers and dates mixed in"],
  ["IMG", "A few images (PNG/JPG, one larger than 5 MB) and a PDF"],
];

const M = (id, title, goal, setup, cases) => ({ id, title, goal, setup, cases });

export const MODULES = [
  M("M00", "Environment and test accounts", "Get everything the other modules need, and record what you test against.", [
    "Use a desktop browser (Chrome or Edge, latest) for OWNER, and a second browser or a private window for every other account.",
    "Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…). Every account needs two-factor.",
  ], [
    ["Record the version under test", ["Open Help → Release notes.", "Open <API>/v1/version in a browser tab."], "Both show the same version (0.16.7 or later; never 0.0.0). Note it at the top of this workbook.", "P1", "UI"],
    ["OWNER signs in for the first time", ["Sign in as OWNER with the agreed password."], "You are taken to “Set up two-factor sign-in” and nothing else opens until it is done.", "P1", "Security"],
    ["OWNER sets up two-factor", ["Click Set up two-factor authentication.", "Scan the QR code with the authenticator app.", "Enter the 6-digit code and Turn on."], "Two-factor turns on and TableOS opens Home. Account → Two-factor shows On and has no “Turn off” option.", "P1", "Security"],
    ["Create the test workspaces and base", ["As OWNER create WS-A and WS-B on Home.", "In WS-A create BASE-1 with tables Contacts, Companies, Deals; in WS-B create BASE-2."], "All appear on Home under the right workspace.", "P1", "Data"],
    ["Invite the test accounts", ["Members & access → People → invite each account from the Accounts table with the stated account type and access.", "Each person opens the invitation email (or the copied link), creates an account and sets up two-factor."], "Every account can sign in and sees only what it was given.", "P1", "UI"],
    ["Prepare the test files", ["Create CSV-S, CSV-L, XLSX, CSV-BAD and IMG on your computer."], "Files ready for M20–M22.", "P2", "Data"],
  ]),

  M("M01", "Sign-up and invitations", "Only invited people (or allowed email domains) can create accounts; nobody gets a personal organization.", [
    "OUTSIDER and DOMAIN are not signed in. Allowed domains are set in M07 first if you test DOMAIN here.",
  ], [
    ["Sign-up page explains invitations", ["Open /signup while signed out."], "The page says TableOS accounts are by invitation.", "P3", "UI"],
    ["Stranger can't sign up", ["Sign up with the OUTSIDER email."], "Refused: “TableOS accounts are by invitation only…”. No account is created.", "P1", "Security"],
    ["Invited person signs up from the link", ["Invite a new email to BASE-1 as Viewer.", "Open the invitation link signed out → Sign up with that email."], "Account created, invitation accepted, the person lands on two-factor setup, then sees only BASE-1.", "P1", "UI"],
    ["Invitation for the wrong account", ["While signed in as EDITOR, open an invitation sent to another email."], "TableOS says the invitation was sent to another address and asks to sign in with it.", "P2", "Security"],
    ["Expired or cancelled invitation", ["Cancel a pending invitation in Members & access, then open its link."], "The link shows “expired or revoked”.", "P2", "Security"],
    ["Allowed-domain sign-up", ["With @bluecascade.org in allowed domains (M07), sign up as DOMAIN without an invitation."], "Account created as Member with no access. OWNER and Admins get a bell notification “New member: …”.", "P1", "Security"],
    ["No personal organization", ["After any sign-up above, open the account menu → Members & access, and Home."], "No organization or “Home” workspace of their own was created.", "P1", "Security"],
    ["Invitation with an account type", ["As OWNER invite an email as Admin with “No workspace or base yet”. Open the link signed out."], "The invitation page says “You’ll join as Admin”. After accepting, the person is Admin.", "P2", "UI"],
    ["Re-invite never lowers an account type", ["Invite ADMIN again as a Member to a base and accept it."], "ADMIN is still Admin, with the extra base access.", "P2", "Security"],
  ]),

  M("M02", "Sign-in, two-factor and sessions", "Sign-in always needs the password and a two-factor code; sessions end after 30 idle days.", [], [
    ["Sign in with code", ["Sign out, sign in as EDITOR with password, enter the authenticator code."], "Signed in. A wrong code shows “Invalid authentication code”.", "P1", "Security"],
    ["Too many wrong codes", ["Enter a wrong two-factor code 5 times."], "The sign-in attempt expires and you must enter the password again.", "P2", "Security"],
    ["Two-factor can't be turned off", ["Account → Two-factor authentication."], "Shows On and a note that it can't be turned off. No turn-off form.", "P1", "Security"],
    ["Show password", ["On sign-in, sign-up and Change password click the eye icon."], "The password becomes visible and hides again.", "P3", "UI"],
    ["Change password", ["Account → Password → change it."], "Saved. Other sessions of that account are signed out; the current one stays.", "P2", "Security"],
    ["Sessions list", ["Account → Sessions: sign in from a second browser, then “Sign out other sessions”."], "Both sessions listed with browser and IP; the other browser is signed out on its next action.", "P2", "Security"],
    ["Session ends after 30 idle days", ["(Optional, needs database access) Ask the developer to age a session past 30 days, then use it."], "You are sent to the sign-in page. Activity within 30 days keeps you signed in.", "P3", "Security"],
    ["Back after signing in", ["Signed out, open a deep link (a base URL). Sign in."], "After sign-in (and two-factor) you land on that base.", "P2", "UI"],
    ["Google sign-in (if enabled)", ["Click Sign in with Google with an invited Google account."], "Signs in; two-factor is still required.", "P3", "Security"],
  ]),

  M("M03", "Sign-in security: wrong passwords and alerts", "Five wrong passwords lock an account for 15 minutes; Owners are alerted with email and IP.", [
    "Use the EDITOR account. Have OWNER signed in elsewhere to watch the bell.",
  ], [
    ["Attempts 1–2: no warning", ["Enter a wrong password twice for EDITOR."], "Plain “Incorrect email or password”.", "P2", "Security"],
    ["Attempts 3–4: warning", ["Enter a wrong password a 3rd and 4th time."], "A warning with attempts left (e.g. “2 attempts left”).", "P1", "Security"],
    ["Attempt 5: locked 15 minutes", ["Enter a wrong password a 5th time, then the right one."], "Account locked with a countdown; the right password is refused while locked.", "P1", "Security"],
    ["Owner alerts", ["Check OWNER’s bell and email."], "One alert per wrong attempt with the email tried, IP, browser, time and “Wrong password n of 5”, plus a lock alert.", "P1", "Security"],
    ["Owner is never locked", ["Enter OWNER’s password wrong 6 times (in a private window)."], "OWNER is not locked (the general rate limit of 10 tries per 15 minutes per IP still applies).", "P2", "Security"],
    ["Unlock after 15 minutes", ["Wait 15 minutes, sign in as EDITOR with the right password."], "Works and resets the count.", "P2", "Security"],
  ]),

  M("M04", "Account types: Owner, Admin, Member", "Only Owners change account types; several Owners; transfer; at least one Owner always remains.", [], [
    ["Account types offered", ["As OWNER open Members & access → People → Invite."], "Account type list is exactly Member, Admin, Owner.", "P1", "UI"],
    ["Owner changes an account type", ["Change EDITOR to Admin and back to Member with the Account type select."], "Confirmation, then the badge changes; Activity log records it.", "P1", "UI"],
    ["Admin can't change account types", ["As ADMIN open People."], "No Account type selects and no Transfer ownership.", "P1", "Security"],
    ["Second Owner", ["Invite OWNER2 as Owner; accept."], "OWNER2 sees every workspace and base, and Members & access.", "P1", "Security"],
    ["Owner steps down (two Owners)", ["As OWNER2 set your own account type to Admin."], "Allowed while another active Owner exists.", "P2", "UI"],
    ["Last Owner can't step down", ["With a single Owner, try to make yourself Admin."], "Refused: the organization needs at least one Owner.", "P1", "Security"],
    ["Transfer ownership", ["As OWNER click Transfer ownership on OWNER2 (or a Member) and confirm."], "They become Owner and you become Admin. (Restore afterwards.)", "P2", "UI"],
    ["Admin data access is only what is given", ["As ADMIN (Creator on WS-A only) open Home."], "ADMIN opens WS-A’s bases but not WS-B’s; WS-B is listed by name (rename/delete only).", "P1", "Security"],
    ["Billing is Owner-only", ["As ADMIN look for plan/billing options or call the billing endpoint."], "Not available to Admins.", "P3", "Security"],
  ]),

  M("M05", "Members & access: invites, roles, end dates", "One invite form everywhere; roles per workspace or base; Admins only within their reach.", [], [
    ["Invite to selected bases", ["Invite with “Selected bases only”, tick two bases, role Editor."], "The person sees exactly those two bases, as Editor.", "P1", "UI"],
    ["Invite to a whole workspace", ["Invite with “Workspace · WS-A (all its bases)”, role Viewer."], "The person sees every base in WS-A, read-only.", "P1", "UI"],
    ["Workspace Owner role", ["Give CREATOR the Workspace Owner role on WS-B.", "As CREATOR: rename WS-B, edit a base’s fields in WS-B, try Create a base in WS-B."], "Rename (and delete) WS-B works and CREATOR is Creator on every base in it; creating bases still needs Owner or Admin.", "P2", "Security"],
    ["Home Share uses the same form", ["On Home click Share on WS-A."], "The same invite form, starting with the whole workspace; the member list below.", "P2", "UI"],
    ["Change a role", ["Edit access → change a base role from Editor to Viewer."], "The person can no longer edit (refresh their page).", "P1", "Security"],
    ["Base role overrides workspace role", ["VIEWER has Viewer on WS-A. Set BASE-1 to Editor for VIEWER, and another base to “No access to this base”."], "VIEWER edits BASE-1, can't see the blocked base, still reads the others.", "P1", "Security"],
    ["Access end date", ["Set “Access until” to tomorrow on a grant."], "Shown as time-limited; after the date the access disappears.", "P2", "Security"],
    ["Bulk change", ["Tick several rows in Edit access and Apply a role to selected."], "All selected rows change.", "P2", "UI"],
    ["Suspend and reactivate", ["Suspend EDITOR, try to open BASE-1 as EDITOR, then reactivate."], "Suspended: nothing opens. Reactivated: access back with the same roles.", "P1", "Security"],
    ["Remove from organization", ["Remove a test Member."], "All their access and devices here are gone.", "P1", "Security"],
    ["Admin manages Members within reach", ["As ADMIN invite a Member to WS-A; change their role; suspend them."], "All allowed.", "P1", "Security"],
    ["Admin limits", ["As ADMIN try: invite to WS-B, give a role above Creator, change OWNER’s or another Admin’s access, change your own access, invite an Admin."], "Each is refused with a clear message.", "P1", "Security"],
    ["Admin sees only what they manage", ["As ADMIN open Members & access."], "Only WS-A (and its bases) appear in the invite form and access matrix.", "P1", "Security"],
    ["Member can't open Members & access", ["As EDITOR open the account menu → Members & access."], "“Only Owners and Admins can manage access.”", "P1", "Security"],
    ["Pending invitations", ["Check the invitations list; cancel one."], "Listed with role and expiry; cancelled invitation link stops working.", "P2", "UI"],
  ]),

  M("M06", "Device approval", "With device approval on, every non-Owner needs each browser approved.", [
    "Security → Require device approval is on (default).",
  ], [
    ["New device waits", ["Sign in as EDITOR in a new browser."], "A “waiting for approval” banner; no data opens.", "P1", "Security"],
    ["Owner/Admin notified", ["Check OWNER’s and ADMIN’s bell."], "“Device approval needed” with browser and IP.", "P2", "UI"],
    ["Approve", ["Members & access → Devices → Approve."], "EDITOR’s page unlocks by itself.", "P1", "Security"],
    ["Revoke and forget", ["Revoke the device, then Forget it."], "Revoked device is blocked again; forgotten device asks for approval next time.", "P2", "Security"],
    ["Admin limits on devices", ["As ADMIN try to approve your own device or OWNER’s."], "Refused. ADMIN can approve Members’ devices.", "P1", "Security"],
    ["Owner is exempt", ["Sign in as OWNER in a new browser."], "No approval needed.", "P2", "Security"],
    ["Device log", ["Open Devices and expand a person."], "Waiting/approved/revoked devices, active and ended sessions, history of approvals with who decided.", "P3", "UI"],
    ["Turn approval off", ["Security → untick Require device approval; sign in from a new browser as EDITOR."], "No approval needed. Turn it back on afterwards.", "P2", "Security"],
  ]),

  M("M07", "Security settings and Activity log", "Allowed sign-up domains and the audit trail.", [], [
    ["Add and remove allowed domains", ["Security → add “@example.org”, then remove it."], "Chip appears and disappears; invalid input like “not a domain” is refused.", "P1", "UI"],
    ["Admins can change security", ["As ADMIN change allowed domains."], "Allowed.", "P2", "Security"],
    ["Activity log lists events", ["Members & access → Activity."], "Recent sign-ins, invitations, role changes, devices, tokens, moves… with who, what, when and IP.", "P1", "UI"],
    ["Activity filter", ["Choose each filter (Invitations, Devices…)."], "Only that kind of event is listed.", "P2", "UI"],
    ["Show older", ["With more than 100 events, click Show older."], "Older events load below.", "P3", "UI"],
    ["Members can't see Activity", ["As EDITOR try /admin?tab=activity."], "Refused.", "P1", "Security"],
  ]),

  M("M08", "Workspaces", "Only Owners and Admins create workspaces; rename and delete with a warning.", [], [
    ["Owner creates a workspace", ["Home → + Create workspace."], "Created and listed in the sidebar.", "P1", "UI"],
    ["Members can't create workspaces", ["As EDITOR look for + Create workspace."], "Not shown; the API refuses it too.", "P1", "Security"],
    ["Organization picker", ["As an account that is Owner/Admin of two organizations, create a workspace."], "The dialog asks which organization.", "P3", "UI"],
    ["Rename workspace", ["Workspace ⋯ → Rename."], "Name changes everywhere.", "P2", "UI"],
    ["Delete workspace with warning", ["Workspace ⋯ → Delete workspace…", "Try to confirm before typing the name, then type it and delete."], "Delete stays disabled until the exact name is typed; then the workspace and its bases disappear for everyone.", "P1", "UI"],
    ["Who can delete", ["As EDITOR and as VIEWER open the workspace ⋯ menu."], "No Delete or Rename for them.", "P1", "Security"],
    ["Contacts directory", ["Workspace ⋯ → Contacts: add, edit, search, delete a contact."], "Works for people with a workspace role; base-only people don’t get Contacts.", "P2", "UI"],
    ["Empty Home for people without access", ["Sign in as DOMAIN (no access yet)."], "“Nothing has been shared with you yet” with an explanation.", "P3", "UI"],
  ]),

  M("M09", "Bases", "Create, rename, duplicate, move, delete and restore bases.", [], [
    ["Create a base", ["In WS-A click Create a base → Start from scratch."], "Opens with Table 1, a default Grid view and 3 empty rows.", "P1", "UI"],
    ["Create from a CSV", ["Create a base → Import a CSV."], "Base created with the file’s columns and rows.", "P2", "UI"],
    ["Rename a base", ["Base ⋯ (Home card or base title menu) → Rename."], "Name updated in Home, title and search.", "P2", "UI"],
    ["Duplicate a base (Owner/Admin)", ["Base card ⋯ → Duplicate."], "A copy with tables, fields, views and records appears in the same workspace.", "P1", "UI"],
    ["Members can't duplicate", ["As CREATOR look for Duplicate."], "Not shown; API refuses.", "P1", "Security"],
    ["Move to another workspace", ["Base card ⋯ → Move to workspace… → WS-B."], "Base listed in WS-B with all data, automations and share links working; people who had access only through WS-A lose it; base-level roles stay.", "P1", "UI"],
    ["Move limits", ["As CREATOR (not Owner/Admin/Workspace Owner of both) try to move."], "Refused.", "P2", "Security"],
    ["Delete a base", ["Base ⋯ → Delete → confirm."], "Removed for everyone.", "P1", "UI"],
    ["Base IDs", ["Table tab menu → IDs & API…"], "Shows bas_… and tbl_… IDs with copy buttons.", "P3", "UI"],
  ]),

  M("M10", "Tables", "Add, rename, duplicate, hide, delete and restore tables.", [], [
    ["Add a blank table", ["+ next to the table tabs → Blank table."], "New tab with a default Grid view.", "P1", "UI"],
    ["Rename, duplicate, hide", ["Table tab menu → Rename / Duplicate / Hide."], "Each works; hidden tables can be shown again.", "P2", "UI"],
    ["Reorder tables", ["Drag a table tab."], "Order is kept after refresh.", "P3", "UI"],
    ["Delete and restore", ["Delete a table, then Tools → Trash → restore."], "Table and data come back.", "P1", "Data"],
    ["Table limit", ["(Free plan: 50 tables per base.) Create tables until refused, or ask the developer to check."], "A clear plan-limit message at the limit.", "P3", "Limit"],
    ["Viewer can't change tables", ["As VIEWER open the table tab menu."], "No create/rename/delete.", "P1", "Security"],
  ]),

  M("M11", "Fields and field types", "Every field type stores, shows and converts values correctly.", [
    "Use a scratch table in BASE-1. For each type: create the field, enter 3 values (normal, empty, edge), refresh, then convert to Single line text and back where it makes sense.",
  ], [
    ["Single line text and Long text", ["Create both; type short, empty and very long (2,000+ chars) values; multi-line in Long text."], "Values saved; long text wraps in tall rows and the expanded record.", "P1", "UI"],
    ["Number, Currency, Percent", ["Set decimals, currency symbol; enter 0, negative, large and decimal values."], "Shown with the chosen format; invalid text refused or converted.", "P1", "UI"],
    ["Duration and Rating", ["Enter 1:30 in Duration; set Rating by click and keys 1–9."], "Stored and shown correctly.", "P2", "UI"],
    ["Checkbox", ["Toggle by click and Enter."], "Toggles; counts in summaries.", "P2", "UI"],
    ["Single and Multiple select", ["Add options with colors, rename an option, delete one, pick values, type a new option."], "Options and colors kept; renaming updates every record.", "P1", "UI"],
    ["User (collaborator)", ["Assign collaborators; allow multiple on/off."], "Only base collaborators listed; avatars shown.", "P2", "UI"],
    ["Date and Date and time", ["Set formats and time zone; enter dates via picker and typing."], "Shown in the chosen format and time zone; sorting by date works.", "P1", "UI"],
    ["Email, URL, Phone", ["Enter valid and invalid values; click the links."], "Valid ones become links (mailto:, tel:, web); invalid ones are flagged/refused.", "P2", "UI"],
    ["Attachment", ["Upload images and a PDF (see M21)."], "Thumbnails in the cell; preview and download work.", "P1", "UI"],
    ["Link to another record", ["Link Deals → Companies; allow multiple off/on (see M16)."], "Chips shown; the other table gets a matching link field.", "P1", "UI"],
    ["Barcode, Button, JSON", ["Enter a barcode value; configure a Button with a URL and click it; enter valid and invalid JSON."], "Barcode stored; button opens the URL; invalid JSON refused.", "P3", "UI"],
    ["Formula, Lookup, Rollup, Count", ["Create each (see M16, M17)."], "Read-only computed values that update when inputs change.", "P1", "UI"],
    ["Autonumber, Record ID, Created/modified time, Created/modified by", ["Add each; create and edit records."], "Filled automatically, read-only; modified fields update on edit.", "P2", "UI"],
    ["Primary field", ["Try to hide/delete the primary field; Set as primary on another field."], "Primary can't be hidden or deleted; another field can become primary.", "P2", "UI"],
    ["Change field type", ["Convert number → text → number, text → single select, date → text."], "Values converted where possible; Ctrl+Z undoes the change.", "P1", "Data"],
    ["Field description and menu", ["Add a description; use header ▾: duplicate, insert left/right, sort, filter, group, freeze, hide."], "Description shows as a tooltip; each menu action works.", "P2", "UI"],
    ["Reorder and resize columns", ["Drag a header; drag its edge."], "Kept after refresh (per view).", "P3", "UI"],
    ["Field permissions", ["Field ▾ → Edit permissions → Creators and up; then Specific users; then Nobody but Creators and Owners. Test with EDITOR and CREATOR."], "EDITOR is blocked as configured; Owners and Creators can always edit.", "P1", "Security"],
    ["Delete a field and restore", ["Delete a field, then restore it from Trash."], "Field and its values come back.", "P1", "Data"],
  ]),

  M("M12", "Editing records in the grid", "Fast, correct editing with mouse and keyboard.", [], [
    ["Type into cells", ["Click a cell and type; press Enter to edit; Esc to cancel."], "Values saved; Esc restores the old value.", "P1", "UI"],
    ["Keyboard navigation", ["Use arrows, Ctrl+arrows, Tab/Shift+Tab, Enter, Space (expand), Shift+Space (select row), Delete (clear)."], "Each shortcut does what Help → Keyboard shortcuts says.", "P2", "UI"],
    ["Copy and paste", ["Copy a range in TableOS and paste elsewhere; paste a range from Excel/Google Sheets."], "Values pasted into the right cells with type conversion.", "P1", "UI"],
    ["Fill handle", ["Select a cell and drag the fill handle down."], "Values copied down.", "P2", "UI"],
    ["Add, insert, duplicate, delete rows", ["+ row at the bottom; right-click a row → insert above/below, duplicate, delete."], "Each works; deleted rows can be restored from Trash.", "P1", "UI"],
    ["Multi-select actions", ["Tick several row checkboxes; delete them."], "All selected rows deleted (and restorable).", "P2", "UI"],
    ["Expanded record", ["Open a record (⤢ or Space); edit hidden fields; move with ↑/↓ or K/J; copy record URL; Esc."], "Everything editable; URL contains rec_…; navigation works.", "P1", "UI"],
    ["Record URL", ["Copy a record URL, open it in another tab."], "Opens the same table, view and record.", "P2", "UI"],
    ["Viewer and Commenter can't edit", ["As VIEWER and COMMENTER try to edit cells, add/delete rows."], "Not possible in the UI; API refuses.", "P1", "Security"],
    ["Large table scrolling", ["Open a table with 5,000+ rows (after CSV-L import) and scroll."], "Smooth; rows load as you scroll; row count in the footer is right.", "P2", "Limit"],
  ]),

  M("M13", "Comments, mentions and history", "Discuss records and see who changed what.", [], [
    ["Comment on a record", ["Expanded record → write a comment."], "Comment shown with author and time.", "P1", "UI"],
    ["@mention", ["Mention EDITOR in a comment."], "EDITOR gets a bell notification that opens the record.", "P1", "UI"],
    ["Edit and delete own comment", ["Edit then delete your comment."], "Allowed for your own; others’ comments can’t be changed.", "P2", "Security"],
    ["Commenter can comment", ["As COMMENTER comment on a record."], "Allowed; editing cells is not.", "P1", "Security"],
    ["Revision history", ["Change several fields; open the record’s history; group by person / by field."], "Every change listed with old → new value, who and when.", "P1", "UI"],
    ["Activity filters", ["Use the record activity filter (all activity, revision history, comments, resolved)."], "Lists filter correctly.", "P3", "UI"],
  ]),

  M("M14", "Undo, redo and trash", "Mistakes can be reversed.", [], [
    ["Undo/redo cell edits", ["Edit cells, press Ctrl+Z several times, then Ctrl+Shift+Z / Ctrl+Y."], "Edits undone and redone in order.", "P1", "UI"],
    ["Undo a deletion", ["Delete rows, press Ctrl+Z."], "Rows come back with their values and links.", "P1", "Data"],
    ["Undo a field type change", ["Change a field type, press Ctrl+Z."], "Type and values restored.", "P2", "Data"],
    ["Trash", ["Tools → Trash: restore a deleted record, field and table."], "Each restored.", "P1", "Data"],
  ]),

  M("M15", "Views", "Every view type and the view toolbar; the default Grid view can never be deleted.", [], [
    ["Default Grid view", ["On any table open the default Grid view’s ⋯ menu."], "No “Delete view” and no “Make personal”; a note “Default view: every table keeps it.” Rename still works.", "P1", "Security"],
    ["Grid view", ["Create a collaborative Grid view."], "Works like the default grid.", "P1", "UI"],
    ["Gallery view", ["Create a Gallery with an attachment as cover."], "Cards with covers; click opens the record.", "P2", "UI"],
    ["Kanban view", ["Kanban by a single select (and by a user field); drag cards between columns."], "Dragging changes the field value.", "P1", "UI"],
    ["Calendar view", ["Calendar on a date field; drag a record to another day."], "Records on their dates; dragging changes the date.", "P2", "UI"],
    ["Timeline and Gantt", ["Set start and end dates; drag/resize bars."], "Bars match the dates; changes saved.", "P2", "UI"],
    ["List view", ["Create a List view."], "Compact readable list.", "P3", "UI"],
    ["Form view", ["Create a Form view (see M22)."], "Form editor opens.", "P1", "UI"],
    ["Hide fields", ["Hide and show fields; drag their order."], "Only this view changes.", "P1", "UI"],
    ["Filter", ["Add conditions for text, number, date, select, checkbox, empty/not empty; nest an OR group."], "Only matching records shown; the filter is saved with the view.", "P1", "UI"],
    ["Sort and group", ["Sort by two fields; group by up to three fields with group summaries."], "Correct order and groups.", "P1", "UI"],
    ["Color and row height", ["Color rows by a select field and by conditions; change row height."], "Applied and saved.", "P3", "UI"],
    ["Search in view", ["Use 🔍 in the toolbar."], "Matches highlighted; moves between matches.", "P2", "UI"],
    ["Summary footer", ["Choose count, sum, average, min, max, filled, empty per column."], "Correct numbers for the visible records.", "P2", "UI"],
    ["Personal, collaborative, locked views", ["Create a personal view (only you see it); lock a collaborative view; try editing it as EDITOR."], "Personal views are private; locked views can’t be changed except by their creator/base Creators.", "P2", "Security"],
    ["Favorites, duplicate, rename, delete", ["Favorite a view; duplicate; rename; delete a non-default view."], "Each works; favorites appear in My favorites.", "P2", "UI"],
    ["Views sidebar", ["Hide the views list with ☰ and show it again; refresh."], "Choice remembered.", "P3", "UI"],
    ["View URL", ["Copy the URL of a view and open it in a new tab."], "Opens the same view.", "P3", "UI"],
  ]),

  M("M16", "Links, lookups, rollups and counts", "Relationships between tables, including across bases.", [], [
    ["Create a link", ["Deals: Link to Companies. Pick records; type to search."], "Chips in Deals; Companies gets a matching link field showing the deals.", "P1", "UI"],
    ["Single vs multiple", ["Turn off “allow multiple” and try to add a second record."], "Only one allowed.", "P2", "UI"],
    ["Lookup", ["Companies → lookup Deals.Amount."], "Shows the linked values; updates when Deals change.", "P1", "Data"],
    ["Rollup", ["Companies → rollup SUM(Deals.Amount), then AVERAGE, MAX, COUNT, ARRAYJOIN."], "Correct results; update live.", "P1", "Data"],
    ["Count", ["Companies → count of Deals."], "Correct counts.", "P2", "Data"],
    ["Unlinking and deleting", ["Remove a link chip; delete a linked record."], "Lookups/rollups/counts update; no orphan errors.", "P1", "Data"],
    ["Link to another base", ["Create a link field → + Link to a table in another base → BASE-2."], "A synced copy of that table is added and linked; lookups work.", "P2", "UI"],
  ]),

  M("M17", "Formulas", "Formula fields compute correctly and report errors clearly.", [], [
    ["Arithmetic and text", ["{Price} * {Quantity}; {First} & \" \" & {Last}; UPPER/LOWER/LEFT/MID."], "Correct values.", "P1", "Data"],
    ["Logic", ["IF, SWITCH, AND/OR, ISBLANK, IFERROR."], "Correct values.", "P1", "Data"],
    ["Dates", ["DATEADD, DATETIME_DIFF, DATETIME_FORMAT, TODAY, NOW, WORKDAY, IS_BEFORE, SET_TIMEZONE."], "Correct values in the base time zone.", "P1", "Data"],
    ["Lists and regex", ["ARRAYJOIN/ARRAYUNIQUE on a lookup; REGEX_MATCH/EXTRACT/REPLACE."], "Correct values.", "P2", "Data"],
    ["Record functions", ["RECORD_ID(), CREATED_TIME(), ROW_NUMBER(), CREATED_BY()."], "Correct values.", "P2", "Data"],
    ["Editor help", ["Type in the formula editor."], "Field and function suggestions appear.", "P3", "UI"],
    ["Errors", ["Write an invalid formula (unknown field, wrong arguments, division by zero)."], "Clear error message; the field isn’t saved broken / shows #ERROR in cells as designed.", "P2", "UI"],
    ["Updates", ["Change an input field."], "Formula value updates immediately (and for other users live).", "P1", "Realtime"],
  ]),

  M("M18", "Synced tables from another base", "Read-only copies that stay up to date.", [], [
    ["Add a synced table", ["+ → Sync from another base → pick BASE-2’s table."], "Table with ⇄ badge, fields and records copied.", "P1", "UI"],
    ["Changes flow", ["Edit/add/delete in the source; wait a few seconds."], "Changes appear in the synced table (full check also every ~5 minutes).", "P1", "Data"],
    ["Schema changes flow", ["Rename, add and delete a field in the source."], "Reflected in the synced table.", "P2", "Data"],
    ["Read-only", ["Try to edit or add records in the synced table."], "Not allowed; your own extra fields stay editable.", "P1", "Security"],
    ["Sync bar controls", ["Sync now, Stop, Pause, Resume."], "Progress shown; each control works.", "P2", "UI"],
    ["Values that don’t fit", ["Put an invalid phone in a source field mapped to Phone; sync."], "Rest syncs; “values couldn’t be synced — review” lets you keep as text or leave empty.", "P2", "Data"],
    ["Stop syncing", ["Tab menu → Stop syncing."], "Becomes a normal editable table.", "P2", "UI"],
    ["Access of the creator", ["Remove the sync creator’s access to the source base."], "Sync stops with an error until someone with access sets it up again.", "P3", "Security"],
  ]),

  M("M19", "Connectors: Airtable, HubSpot, Gmail, Slack", "External data and messaging.", [
    "Needs real accounts/tokens for each service. Skip (mark N/A) any service you don’t use.",
  ], [
    ["Connect Airtable", ["Account menu → Connectors → Airtable → paste a personal access token."], "Connected; listed under Connectors.", "P2", "UI"],
    ["Sync from Airtable", ["+ → Sync from Airtable → base, table, fields."], "Records and fields arrive; linked records show names; attachments show names/links.", "P2", "Data"],
    ["Connect HubSpot and sync", ["Connect a private-app token; Sync from HubSpot → contacts with chosen properties."], "Records arrive with types kept; refresh every 15 minutes; Sync now works.", "P2", "Data"],
    ["HubSpot two-way", ["Tick Two-way; edit a synced field."], "The change appears in HubSpot within seconds; rejected values explained on the bar.", "P3", "Data"],
    ["Gmail", ["Sign in with Google; Sync from Gmail with in:inbox; automation step Send email via Gmail."], "Messages arrive in a table; the email is sent from your address.", "P3", "Data"],
    ["Slack", ["Connect a bot token in the Send Slack message step; run the automation."], "Message posted in the channel.", "P3", "Data"],
    ["Disconnect", ["Remove a connection."], "Removed; syncs using it show an error instead of silently failing.", "P3", "UI"],
  ]),

  M("M20", "Import and export", "Files in and out; export is for Owners and Admins only.", [], [
    ["Import CSV as a new table", ["+ → Import a file → CSV-S; check suggested types; import."], "Table created with the right types and 20 rows.", "P1", "Data"],
    ["Import Excel", ["Import XLSX; pick the second sheet."], "That sheet imported.", "P2", "Data"],
    ["Import TSV/TXT", ["Import a .tsv and .txt file."], "Imported correctly.", "P3", "Data"],
    ["Import into an existing table", ["Table menu → Import into the table; check column matching, + New field, Import all / Don’t import any."], "Columns matched by name; new fields created where chosen.", "P1", "Data"],
    ["Large import in the background", ["Import CSV-L."], "Progress shown; you can keep working; all rows arrive.", "P1", "Limit"],
    ["Stop an import", ["Start CSV-L and press Stop."], "Stops at once with a summary.", "P2", "UI"],
    ["Invalid entries", ["Import CSV-BAD."], "Invalid values listed per row; fix them, import them empty or skip them.", "P1", "Data"],
    ["Name clashes", ["Import a file whose table name already exists."], "A sensible new name or a prompt.", "P3", "UI"],
    ["Export CSV/Excel/JSON", ["As OWNER: Tools → Export CSV (or view menu Download) as CSV, Excel and JSON."], "Only visible fields and filtered records, in view order.", "P1", "Data"],
    ["Members can't export", ["As CREATOR and EDITOR look for Export / Download."], "Not shown; API refuses (copy and paste in the grid still works).", "P1", "Security"],
  ]),

  M("M21", "Attachments", "Upload, preview, download, limits.", [], [
    ["Upload in a cell", ["Drop images and a PDF into an Attachment cell."], "Uploads with progress; thumbnails shown.", "P1", "UI"],
    ["Preview and download", ["Open the expanded attachment view; download a file."], "Preview for images/PDF; download saves the original file.", "P1", "UI"],
    ["Remove and reorder", ["Remove one attachment; reorder."], "Saved.", "P2", "UI"],
    ["File size limit", ["Upload a file over 100 MB."], "Refused with a clear message (per-file limit 100 MB; base limit 1 GB on the Free plan).", "P2", "Limit"],
    ["Attachments in share links", ["See M25 (allow copy off)."], "No download links when copy is off.", "P2", "Security"],
  ]),

  M("M22", "Forms", "Collect records from anyone with the link.", [], [
    ["Build a form", ["Create a Form view; choose fields, mark required ones, add help text."], "Saved.", "P1", "UI"],
    ["Share and submit", ["Share the form link; submit it signed out."], "A new record is created with the values.", "P1", "Data"],
    ["Required fields and validation", ["Submit with a required field empty or an invalid email."], "Refused with a message.", "P1", "Data"],
    ["Attachments in a form", ["Upload a file in the form."], "File attached to the new record.", "P2", "Data"],
    ["Form-submitted automation", ["See M24 trigger “When a form is submitted”."], "Automation runs.", "P2", "Data"],
  ]),

  M("M23", "Interfaces", "Dashboards and app pages on top of the data.", [], [
    ["Create an interface", ["Base → Interfaces → create one."], "Designer opens.", "P1", "UI"],
    ["Each element", ["Add Number, Chart, Date filter, Grid, List, Gallery, Record details, Form, Button, Text, Divider; connect each to a table/view."], "Each element renders the right data.", "P1", "UI"],
    ["Charts", ["Bar, horizontal bar, line, area, pie, donut; group dates by day/week/month/quarter/year; up to four values; sort; limit; labels and legend."], "Correct totals; empty periods shown as zero.", "P2", "Data"],
    ["Date filter", ["Add a Date filter; try each period and a custom range."], "Every element using the same table follows the filter.", "P2", "Data"],
    ["Record details and Form", ["Select a record in a List; Record details shows it; submit the Form element."], "Correct record; new record created.", "P2", "UI"],
    ["Publish/view as others", ["Open the interface as EDITOR and VIEWER."], "They see the page according to their role.", "P2", "Security"],
  ]),

  M("M24", "Automations", "Triggers, actions, tests, run history, Runs as and limits.", [], [
    ["Record created → Update record", ["Create the automation, turn it on, add a record."], "Runs and updates the record; run history shows success.", "P1", "Data"],
    ["Record updated (specific fields)", ["Trigger on one field; edit that field and another."], "Runs only for the chosen field.", "P1", "Data"],
    ["Record matches conditions / enters a view", ["Set conditions; change a record to match."], "Runs once when it starts matching.", "P2", "Data"],
    ["Form submitted", ["Trigger on a form; submit it."], "Runs.", "P2", "Data"],
    ["Scheduled", ["Every N minutes / daily at a time."], "Runs on time (check run history).", "P2", "Data"],
    ["Button clicked", ["Button field with Run automation; click it."], "Runs for that record.", "P2", "Data"],
    ["Webhook received", ["Copy the webhook URL; POST JSON to it (e.g. with curl or Postman)."], "Runs with the payload available as tokens; too many calls in a burst return 429.", "P2", "API"],
    ["Actions", ["Use each: Update, Create, Find, Delete record; In-app notification; Send email; Send webhook; Conditional group."], "Each action does what it says; tokens {} filled from the trigger.", "P1", "Data"],
    ["Run a script", ["Script using input.config(), base.findRecords, base.updateRecord, fetch to a public URL, output.set."], "Works; limits: 30 s total, 2 s CPU, 20 fetches, 100 calls per run; errors shown in history.", "P2", "Limit"],
    ["Test and run history", ["Use Test with a chosen record; open run history and a failed run."], "Step-by-step results and clear error messages.", "P1", "UI"],
    ["Runs as", ["Header “Runs as …”: as a Creator pick another Creator; try an Editor."], "Saved for Creators; refused for Editors; editing no longer changes it.", "P2", "Security"],
    ["Permissions", ["As EDITOR open Automations."], "Can view, can’t create or edit (Creators only).", "P1", "Security"],
    ["Loops are stopped", ["Make automation A update a record that triggers B that triggers A."], "Stops after the chain limit (8) without running forever.", "P2", "Limit"],
    ["Limit per base", ["(150 automations per base.)"], "A plan-limit message at the limit (optional to test).", "P3", "Limit"],
    ["Duplicate, rename, delete, turn off", ["Use the automation ⋯ menu."], "Each works; turned-off automations don’t run.", "P2", "UI"],
  ]),

  M("M25", "Public share links", "Read-only links for people outside TableOS, Creators and up only.", [], [
    ["Creator creates a view link", ["As CREATOR: Share view → Create shareable link."], "Link created; opens signed out in a private window.", "P1", "UI"],
    ["Editor can’t create or change links", ["As EDITOR open Share view."], "Message “Only Creators and Owners…”; controls disabled.", "P1", "Security"],
    ["Shared page content", ["Open the link signed out."], "Only the view’s visible fields and filtered records; search and sort work; table tabs for base links.", "P1", "Security"],
    ["Allow copy off (default)", ["On the shared page try copy, cut, right-click, drag; check attachments; load more records."], "Copy/cut/right-click/drag blocked; attachments have no download; records load 50 at a time.", "P1", "Security"],
    ["Allow copy on", ["Turn on Allow copying data; reload the page."], "Copying works; attachments downloadable.", "P2", "UI"],
    ["Password", ["Add a password; open the link; wrong password 5 times."], "Password asked; warnings on attempts 3–4; locked 15 minutes on the 5th; Owner alerted.", "P1", "Security"],
    ["Expiry", ["Set an expiry a few minutes ahead; wait."], "Link stops working after it.", "P2", "Security"],
    ["Generate new link / Disable", ["Generate a new link, then Disable."], "Old link stops at once; disabled link shows not found.", "P1", "Security"],
    ["Share entire base", ["Share view → Entire base."], "All tables readable via the link.", "P2", "UI"],
  ]),

  M("M26", "Search, notifications and contacts", "Find things and stay informed.", [], [
    ["Search palette", ["Ctrl+K: search a base, a table, a record value."], "Results grouped; Enter opens the right place; only things you can open are listed.", "P1", "UI"],
    ["Search after moving a base", ["Move a base (M09) then search its records."], "Still found.", "P3", "Data"],
    ["Notification bell", ["Trigger a mention, a comment on your record, an automation notification."], "Each appears with unread count; clicking opens the record; mark read/unread; mark all read.", "P1", "UI"],
    ["Desktop notifications", ["Allow browser notifications when asked."], "New notifications pop up on the desktop.", "P3", "UI"],
    ["Hidden after losing access", ["Notify EDITOR about BASE-1, then remove EDITOR’s access."], "That notification disappears and isn’t counted.", "P2", "Security"],
    ["Member emails are private", ["As EDITOR open Share/member lists and @mention list."], "Names only (your own email visible); Owners/Admins/Workspace Owners see emails.", "P2", "Security"],
  ]),

  M("M27", "Live collaboration (realtime)", "Changes appear for everyone without refreshing.", [
    "Open BASE-1 as OWNER in one browser and as EDITOR (and ADMIN) in another, side by side.",
  ], [
    ["Live cell edits", ["OWNER edits a cell."], "EDITOR sees it within about a second, without refreshing. And the other way round.", "P1", "Realtime"],
    ["Live rows", ["Add and delete rows in one browser."], "Appear/disappear in the other.", "P1", "Realtime"],
    ["Live schema", ["Add, rename, delete a field; create a view."], "Other browser updates.", "P2", "Realtime"],
    ["Presence", ["Both open the same table."], "Avatars of who is here at the top.", "P2", "Realtime"],
    ["Same cell at once", ["Both edit the same cell at the same time."], "Last write wins without errors; both end with the same value.", "P2", "Realtime"],
    ["Reconnect", ["Turn Wi-Fi off for 30 seconds in one browser, make changes in the other, turn it on."], "The first browser catches up automatically.", "P2", "Realtime"],
    ["Different roles", ["VIEWER watches while EDITOR edits."], "VIEWER sees live changes but can’t edit.", "P2", "Realtime"],
  ]),

  M("M28", "API and access tokens", "The public record API, token scopes and errors.", [
    "Use curl, Postman or similar. Token from Members & access → API tokens. Base URL = the TableOS address with no trailing slash; send the token as Authorization: Bearer tos_…. Find table IDs in the table tab menu → IDs & API, or with GET /v1/api/bases.",
  ], [
    ["Create a token", ["Create tokens: Read only; Read+Write; Read+Write+Delete; one limited to BASE-1; one with an expiry."], "Token shown once; listed with types, bases, expiry.", "P1", "API"],
    ["List bases", ["GET /v1/api/bases with the token."], "Only reachable bases with tables and IDs.", "P1", "API"],
    ["Schema", ["GET /v1/bases/{baseId} and GET /v1/tables/{tableId}."], "Tables and fields.", "P2", "API"],
    ["Query records", [" /v1/tables/{tableId}/records/query with pageSize, sort, filter (eq, contains, gt, empty, and/or), search, fields, viewId; follow nextCursor."], "Correct records and paging; nextCursor null on the last page.", "P1", "API"],
    ["Read one record", [" /v1/tables/{tableId}/records/{recordId}?fields=fld_a,fld_b."], "That record with the asked fields.", "P2", "API"],
    ["Group", [" /v1/tables/{tableId}/records/group."], "Grouped counts/aggregates.", "P3", "API"],
    ["Create, update, delete", [" /v1/tables/{tableId}/records;  /v1/tables/{tableId}/records/{id};  /v1/tables/{tableId}/records/{id}; use field names and IDs; typecast true for a select option name."], "Works; changes appear live in the UI and in record history as “via API”.", "P1", "API"],
    ["Batches of 500", [" /v1/tables/{tableId}/records/batch with 500 records, then 501;  /v1/tables/{tableId}/records/batch;  /v1/tables/{tableId}/records/batch-delete."], "500 works; 501 refused with a clear error.", "P1", "Limit"],
    ["Token types enforced", ["Use the Read-only token to create; the Write token to delete."], "403 with the missing type named.", "P1", "Security"],
    ["Base limits enforced", ["Use the BASE-1-only token on BASE-2."], "404/403.", "P1", "Security"],
    ["Revoked/expired tokens", ["Revoke a token and call the API; wait for an expired one."], "401 immediately.", "P1", "Security"],
    ["Admin tokens", ["As ADMIN create a token; read WS-B data with it."], "Refused: an Admin’s token only reaches what the Admin was given. Admin sees only their own tokens.", "P1", "Security"],
    ["Non-record APIs refused", ["Call e.g. /v1/workspaces with a token."], "403 “API tokens can only call the record API”.", "P2", "Security"],
    ["Synced tables are read-only", ["Write to a synced table via API."], "403.", "P2", "API"],
    ["Errors", ["Send invalid JSON, an unknown field, a stale version, a missing token."], "400/422 listing the problem; 409 for a stale version (the message says which version the record is at); 401 without token. Each error's “type” is a link to Help → API reference on this TableOS.", "P2", "API"],
    ["Version", ["GET /v1/version without a token; check the x-tableos-version header on any response."], "Both show the running version.", "P3", "API"],
    ["Rate per token", ["Send 30 requests in one second with one token (plan: Free 5/s, Team 20/s)."], "About 5 succeed on Free (20 on Team); the rest get 429 with a retry-after header and a message naming the limit. Requests a few per second are never limited.", "P2", "Limit"],
  ]),

  M("M29", "Limits and performance", "TableOS behaves well at its limits and with real amounts of data.", [], [
    ["Sign-in rate limit", ["From one IP try 11 wrong sign-ins for an Owner within 15 minutes."], "429 “Too many attempts” after 10.", "P2", "Limit"],
    ["Sign-up rate limit", ["(Production: 30 sign-ups per IP per hour.)"], "429 after the limit (optional).", "P3", "Limit"],
    ["Import request size", ["Import a file with 2,000+ rows."], "Sent in chunks; all rows imported.", "P2", "Limit"],
    ["Big base", ["A table with 30,000 records and 30 fields: scroll, filter, sort, group, search."], "Usable (record times; anything over ~3 s is worth reporting).", "P1", "Limit"],
    ["Many people at once", ["5+ people edit the same base for 10 minutes."], "No lost edits, no errors, realtime keeps up.", "P2", "Limit"],
    ["Text and name lengths", ["Names over 200 characters (workspace/base/automation), comments over 10,000 characters."], "Refused with a clear message.", "P3", "Limit"],
    ["Server stays healthy", ["During heavy use ask the developer to watch logs (no out-of-memory or Redis errors)."], "No errors.", "P2", "Limit"],
  ]),

  M("M30", "Permission matrix spot checks", "One pass through the roles to make sure each sees exactly what it should.", [
    "For each row, sign in as that account and try the action in BASE-1 (and WS-B where noted).",
  ], [
    ["OWNER", ["Open every workspace/base; Members & access; export; duplicate; move; delete."], "Everything allowed.", "P1", "Security"],
    ["ADMIN", ["WS-A bases; WS-B bases; Members & access (Members only); billing."], "WS-A yes; WS-B no data; Members yes; billing no.", "P1", "Security"],
    ["CREATOR (base)", ["Schema changes, automations, share links, interfaces; export; duplicate base."], "Schema/automations/share/interfaces yes; export and duplicate no.", "P1", "Security"],
    ["EDITOR (base)", ["Edit records, shared views, import; fields/tables; share links; automations."], "Records, views, import yes; fields/tables, share links, automations no.", "P1", "Security"],
    ["COMMENTER (base)", ["Comment; personal views; edit cells."], "Comment and personal views yes; editing no.", "P1", "Security"],
    ["VIEWER (workspace)", ["Read every base in WS-A; edit; comment."], "Read yes; edit/comment no.", "P1", "Security"],
    ["DOMAIN (no access)", ["Home; any base URL."], "Nothing opens until given access.", "P1", "Security"],
    ["Direct URLs and API", ["Paste URLs of things you shouldn’t see; call the API with a session (browser dev tools) for forbidden actions."], "404/403 everywhere; no data leaks in responses.", "P1", "Security"],
  ]),

  M("M31", "Help, UI and browsers", "Everything is understandable and works across browsers and screen sizes.", [], [
    ["Help pages", ["Open every Help topic; follow links between them."], "Content matches what TableOS does; no broken links.", "P3", "UI"],
    ["Release notes", ["Help → Release notes."], "Current version listed first.", "P3", "UI"],
    ["Browsers", ["Repeat a short smoke test (sign in, edit a cell, open a record, create a view) in Chrome, Edge, Firefox and Safari."], "Works the same.", "P2", "UI"],
    ["Small screens", ["Use a 1366×768 laptop screen and a tablet/phone width."], "Nothing important cut off; dialogs scroll.", "P3", "UI"],
    ["Error messages", ["Throughout testing, note any message that is unclear, technical or in the wrong place."], "Messages are clear and say what to do.", "P3", "UI"],
    ["Slow network", ["Chrome dev tools → Network → Slow 3G; use the app."], "Loading states shown; no duplicate actions.", "P3", "UI"],
  ]),
];

/**
 * Plan 2.0 (TableOS 0.16.3–0.16.7): checks for what the fix phases changed. Appended to their modules
 * so the plan 1.0 case numbers stay the same.
 */
const V2_CASES = {
  M02: [
    ["Return to the page after signing in", ["Open a base and table.", "Account menu → Log out.", "Sign in again (with two-factor)."], "You land back on that base and table, not Home.", "P2", "UI"],
    ["Two-factor setup page", ["With two-factor required, sign in with an account that hasn’t set it up.", "Press Back; open TableOS in a new tab."], "The page shows who is signed in, a Sign out button at the top and explains that every page opens it until two-factor is set up.", "P3", "UI"],
  ],
  M05: [
    ["Invite someone again after removing them", ["Remove a Member.", "Invite the same email again (as Member).", "Open the invitation link signed out."], "The page says the email already has an account → Sign in to accept. After accepting they’re back with the new invitation’s account type (not their old one).", "P2", "UI"],
    ["Invite row fits", ["Workspace Share dialog and Members & access, at 1280 and 1920 px wide, as OWNER (most columns)."], "Email, account type, access, role and Invite all fit or wrap; nothing spills outside the box.", "P3", "UI"],
    ["Access shown matches reality", ["As ADMIN with Viewer on one base, open Members & access → People.", "As OWNER, change someone’s access and look again."], "Your own row says “your access: Viewer on …”; other people’s rows count access in places you don’t manage instead of “no access”. Changes show right away.", "P2", "UI"],
  ],
  M10: [
    ["Adding tables needs Creator", ["As EDITOR (or an Admin who is only Editor/Viewer on the base) look at + Add or import."], "Greyed out; hovering says only Creators and Owners of this base can add tables. Any refusal is in plain words (no “base.manage_schema”).", "P2", "Security"],
  ],
  M11: [
    ["Invalid email and phone are refused", ["Type “a@b”, “x..y@a.com” in an Email cell; “123” and a 20-digit number in a Phone cell.", "Then type valid ones (name@example.com, +92 300 1234567)."], "Invalid values aren’t saved and a message says why; valid ones save and become mailto:/tel: links.", "P1", "Data"],
    ["Paste multi-line JSON into one cell", ["Copy a pretty-printed JSON object (several lines).", "Select one cell of a JSON field and paste."], "The whole object goes into that one cell; no rows are created or changed. Pasting invalid JSON shows “That isn’t valid JSON” and changes nothing.", "P1", "Data"],
    ["Lookup without a link", ["In a table with no link field, add a Lookup (or Rollup/Count).", "Try the same in a synced table."], "It explains a link is needed and offers “Add a link field instead”; in a synced table it explains lookups go in the table that links to it.", "P3", "UI"],
    ["Link picker tells records apart", ["Link to a table whose primary field is Record ID; open the picker."], "Each record shows a few of its values (e.g. “Company: Acme”) under its ID.", "P3", "UI"],
  ],
  M12: [
    ["Esc discards a long-text edit", ["Type into a Long text cell (and in edit mode with Enter), press Esc."], "The old value stays; nothing is saved. Enter/Tab/clicking away still save.", "P1", "Data"],
  ],
  M14: [
    ["Undo a field type change keeps values", ["Fill a Multiple select field in several records; change it to Checkbox.", "Press Ctrl+Z."], "Checked boxes appear where options were picked; after Ctrl+Z the field is Multiple select again with the same options and every value back.", "P1", "Data"],
    ["Redo and undo of removed options", ["After the undo above press Ctrl+Shift+Z (redo), then Ctrl+Z again.", "Remove an option from a select field; Ctrl+Z."], "Redo re-applies the change; undo brings the removed option and its values back. Undo never jumps to an older, unrelated edit.", "P2", "Data"],
  ],
  M15: [
    ["Search highlights cells", ["Toolbar 🔍 → type a word that appears in several cells.", "Press Enter several times, then Shift+Enter; press Esc."], "Matching cells are highlighted; the bar says “1 of N matching cells”; Enter/Shift+Enter (or ↑ ↓) move between them; Esc closes the search.", "P2", "UI"],
    ["+ next to Find a view", ["Click the + next to “Find a view” (in Chrome, Edge, Firefox and Safari)."], "A new Grid view is created and selected with its name ready to edit.", "P2", "UI"],
  ],
  M21: [
    ["Attachments on a shared view", ["Share a view that has attachments with “Allow copying data” off; open it signed out and click a file.", "Turn copying on, reload, click again."], "Off: the file opens with “Downloading is turned off”, no Download button. On: Open and Download work and the file downloads.", "P2", "UI"],
  ],
  M23: [
    ["Form element Submit button", ["Add a Form element to an interface page; publish; open it in Published mode.", "Fill it and submit."], "A dark Submit button is visible (grey while editing); submitting creates the record.", "P2", "UI"],
  ],
  M25: [
    ["Share password lock and alert IP", ["Wrong password 5 times on a password-protected link (signed out, normal internet, not the office VPN if possible)."], "Warnings on attempts 3–4, locked 15 minutes on the 5th; the Owner’s alert shows your real public IP (not a 10.x address).", "P1", "Security"],
  ],
  M26: [
    ["Search palette closes", ["Ctrl+K; click the Esc button; Ctrl+K again and press Esc; also after clicking inside the list."], "The palette closes every time.", "P3", "UI"],
  ],
  M28: [
    ["Field names in responses", ["GET …/records and POST …/records/query with a token.", "Repeat with ?returnFieldsByFieldId=true (or \"returnFieldsByFieldId\": true in the body)."], "Records are keyed by field name with option names for selects (e.g. \"Status\": \"Active\"). With the flag: field IDs and option IDs.", "P1", "API"],
    ["List records with GET", ["GET /v1/tables/{tableId}/records?pageSize=5&fields=Name in a browser-like client."], "Records and nextCursor; GET on …/records/query says to use POST (405).", "P2", "API"],
    ["URL and header variants", ["Base URL ending in “/” (//v1/…), a trailing slash, a token without the word Bearer, a token in quotes."], "All work. A wrong path is refused with a message listing what tokens can call.", "P2", "API"],
    ["Changes via API in history", ["Create or edit a record with a token; open the record’s history in TableOS."], "The entries are tagged “Via API”; edits made in the app are not.", "P2", "API"],
    ["Help → API reference samples", ["Open Help → API reference; compare a sample with a real call."], "Every endpoint has request and response samples that match what the API returns (field names, error bodies).", "P3", "API"],
  ],
  M31: [
    ["Product name", ["Look through pages, emails, API errors (the “type” link), webhooks’ User-Agent and downloaded files."], "Everything says TableOS; no other product name appears anywhere.", "P3", "UI"],
  ],
};
for (const m of MODULES) m.cases.push(...(V2_CASES[m.id] ?? []));
