# Changelog

All notable changes to TableOS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). See [docs/VERSIONING.md](docs/VERSIONING.md)
for how releases are cut. The same notes appear in the app under
**Help → Release notes** (`apps/web/src/features/help/releases.ts`).

## [Unreleased]

## [0.16.4] - 2026-10-22

### Added
- **Help → API reference: sample JSON for every endpoint** (list bases, base and table schema, query,
  list, read one, group, create, batch create, update, batch update, delete, batch delete, version),
  each with its method and path, token type, request body and response, captured from a real server.
  Sample error bodies for 422 (invalid body, unknown field), 409, 403 and 401.

## [0.16.3] - 2026-10-22

Fix phase 1 of the team's test round (data safety, security and the public API).

### Fixed
- **Esc saved a long-text cell** instead of discarding the edit (M12-01). Esc now cancels in every
  cell editor; Enter, Tab and clicking away still save.
- **Pasting multi-line JSON into one cell spread it over the rows below** and created new rows
  (M11-11). Multi-line text pasted into a single JSON or long-text cell now stays in that cell; a
  real spreadsheet block (tabs or an HTML table) still fills a range. Invalid JSON, pasted or typed,
  is refused with a message instead of being stored as text.
- **Production reported version 0.0.0** in `/v1/version` and `x-tableos-version` (M00-01): the
  bundled server looked for `package.json` one folder too high.
- **`GET /v1/tables/{tableId}`** (and `GET /v1/bases/{baseId}/tables/{tableId}`) was documented but
  missing; it returns the table and its fields (M28-03).
- **API calls failed on common URL and header variants** (M28-04 to M28-10, M28-15): a base URL ending
  in `/` (`//v1/…`), a trailing slash, a token without the word `Bearer` or in quotes. These now work;
  a GET on `…/records/query` returns 405 "use POST" instead of "Invalid rec id"; refusals name the
  request and list what tokens can call; a missing or unknown token says how to send it or that it is
  invalid, revoked or expired.

### Added
- `GET …/records` lists records with `pageSize`, `cursor`, `viewId`, `fields` and `search` in the
  query string (handy from a browser).
- Changes made with an API token show **Via API** in record history.

## [0.16.2] - 2026-10-20

### Fixed
- **Production Redis ran out of memory** ("OOM command not allowed"), which stopped background jobs
  (sync, notifications, search, computed fields) and live updates. Every event is copied into one queue
  per consumer, and each queue kept its last 1,000 finished and 5,000 failed jobs with the whole event.
  Now finished jobs are kept for an hour (at most 50 per queue) and failed ones for a day (at most 100).
- Live-update tickets fall back to memory when Redis refuses writes, so realtime keeps working.

## [0.16.1] - 2026-10-20

### Fixed
- **Live changes between people didn't arrive in production** (they only showed after a refresh): the
  realtime WebSocket ran as a separate process that production never started, and the ticket pointed
  browsers at `127.0.0.1`. The API now serves `/v1/ws` on its own port (`REALTIME_IN_API=false` to turn
  off) and hands out its own address (`wss://` behind HTTPS). Changes reach it through Redis, or in-process
  when there is no Redis. `REALTIME_PUBLIC_URL` still overrides the address.
- The API no longer hangs at start when Redis can't be reached; it falls back to in-memory after 3 seconds.
- **Every table keeps a default Grid view** that nobody (any account type or role) can delete or make
  personal. Migration 0084 makes a shared Grid view the default where another view had taken over (or
  adds one), and allows only one default per table.
- **Owners can delete a workspace** from its menu on Home, after a warning and typing its name
  (Admins and Workspace Owners too, as before on the server).

## [0.16.0] - 2026-10-20

Roles and permissions, phase 3 of the decisions questionnaire (roles R4; history in
`docs/roles-and-permissions/ROLES-CHANGELOG.md`). Migration 0083.

### Changed
- **Two-factor sign-in is required for everyone** (G13, B9). Anyone without it is taken to
  "Set up two-factor sign-in" and can't open anything else until it's on; it can't be turned off.
  Owners stay exempt from lockout and device approval (B11). Automations and API tokens are unaffected.
  Platform switch `core.platform_settings.require_mfa`.
- **Sessions end after 30 days without activity** (G12, B10); each visit restarts the 30 days.
  Sessions already idle for longer end when this version starts.
- **Share links: Creators and up only** (G14, B8). Editors see existing links but can't create or change
  them. With "Allow copying data" off, the shared page blocks copy, cut, drag and right-click, attachments
  come without download links, and records load 50 at a time.
- **Owners and Creators can always edit a field**, even one set to "Nobody" (G15).
- **Automations show "Runs as …"** and a Creator picks which Creator of the base they run as (G16).
  Saving an automation no longer changes who it runs as; existing ones keep their current person.
- **Notifications about bases you can no longer open are hidden** and not counted (G17).
- **Move to workspace…** on a base (G18): same organization; Owners, Admins, or a Workspace Owner of both
  workspaces. Everything in the base moves; roles from the old workspace stop applying.
- **Member emails** in workspace and base member lists are only shown to Owners, Admins and Workspace
  Owners; everyone else sees names (G19).
- **Activity log** tab in Members & access for Owners and Admins, with filters (G20).

### Fixed
- The search index kept a moved base's old workspace when it caught up on earlier changes.

## [0.15.0] - 2026-10-20

Roles and permissions, phase 2 of the decisions questionnaire (roles R3; history in
`docs/roles-and-permissions/ROLES-CHANGELOG.md`).

### Changed
- **Three account types: Owner, Admin, Member** (G7, B14). Billing admin and Guest are gone
  (migration 0082; anyone holding them becomes Member).
- **Several Owners, and Transfer ownership** (G6, B2). Only Owners change account types; an
  organization always keeps at least one Owner. Transfer makes the other person Owner and you Admin.
- **Admins** (B3) invite and manage Members (roles, end dates, No access, suspend, remove, devices),
  create workspaces, rename or delete any workspace, create API tokens, change security settings and
  see the device log. They open only the workspaces and bases an Owner gives them, hand out access
  only where they are Creator (never above their own role), and see only their own API tokens. They
  no longer get automatic access to every workspace. No billing.
- **Invitations carry an account type** (Owners only for Admin/Owner) and an Admin or Owner can be
  invited without any workspace yet. Accepting never lowers an account type.
- **Workspace Owner role** can be given by Owners and Admins (G8).
- **One invite form everywhere** (G11): Share on Home uses the Members & access form, starting on that
  workspace, with "whole workspace or selected bases".
- Device approval requests go to Owners, and to Admins for Members' devices.

## [0.14.0] - 2026-10-19

Roles and permissions, phase 1 of the decisions questionnaire
(`docs/roles-and-permissions/Roles-Decisions-Questionnaire.md`; history in
`docs/roles-and-permissions/ROLES-CHANGELOG.md`).

### Changed
- **Sign-up is by invitation** (G1, G5, B1). An account can only be created with a pending
  invitation for that email, or with an email domain the organization allows. Nobody gets an
  organization of their own any more. Invited people join through the invitation; domain sign-ups join
  as a Member with no access and the Owners and Admins get a notification. Platform setting
  `core.platform_settings.signup_mode` (migration 0081, default `restricted`).
- **Allowed sign-up domains** in Members & access → Security (`settings.signup.allowedDomains`).
- **Only Owners and Admins create workspaces** (G3, B4); with several organizations they choose which one.
- **Only Owners and Admins create bases, duplicate a base or export data** (G2, G4, B6, B7); Create a base,
  Duplicate and Export CSV are hidden for everyone else. A base can only be duplicated into a workspace
  of the same organization.
- **The contacts directory needs a role on the workspace** (G9); people with only base roles don't see it.
- Deleted organizations no longer appear in lists or in the workspace sidebar.

## [0.13.0] - 2026-10-15

### Added
- **Show password.** Sign in, sign up and the account's change-password fields have an eye button
  that shows or hides what you typed (`PasswordInput` in `@tabula/ui`).

### Changed
- **CORS preflight cache:** the API answers preflight requests with `Access-Control-Max-Age: 7200`,
  so browsers repeat them at most every 2 hours.

## [0.12.1] - 2026-10-15

### Fixed
- **Syncs with many invalid values were very slow** (live Airtable syncs crawled for minutes):
  each failing batch was retried one record at a time. Values are now checked against their field
  while the source is read, so invalid ones are set aside up front and batches write normally
  (2,000 records with invalid phones: about 4 seconds).

## [0.12.0] - 2026-10-15

### Fixed
- **One bad value failed the whole sync** ("failed: Phone: Invalid phone number"). Syncs from
  Airtable, HubSpot, Gmail or another base now skip just the value that doesn't fit its field,
  sync everything else, and show "N values couldn't be synced — review" on the bar.
- **Synced tables never refreshed on their own in production**: the scheduler only ran in the
  worker. The API now runs it too (`SYNC_IN_API=false` to turn off); runs lock per sync.
- **Sync now** ran inside the request, so long Airtable syncs timed out. It now starts in the
  background and the bar shows progress ("reading 1,200 records…", "saving 300 of 3,000…").
- Syncing a table whose primary field is Record ID failed (two fields named "Record ID").
- **Stop during an import** now stops at once instead of waiting for the current batch.

### Added
- **Review skipped sync values**: grouped by field with record, value and problem; per field
  choose **Keep as text** (that field becomes text here and the values sync as they are) or
  **Leave empty**. Migration `0080_sync_issues_and_control.sql`.
- **Stop, Pause and Resume on the sync bar.** Stop ends the run in progress (what's written stays;
  Sync now continues); Pause also stops it; Resume starts a run.
- **Invalid import entries** are listed with row, column, value and problem; correct them and
  import again, import them with the invalid value left empty, skip them, or download them.
- **Devices log grouped per person**: waiting, approved and revoked devices (with who decided and
  when), active and ended sign-in sessions, and the full approval/revocation history.
- **Group record history** by person or by field (activity menu → Group revision history).

## [0.11.0] - 2026-10-15

### Added
- **Access per base.** In Members & access a base's own role now overrides the role inherited from
  its workspace (higher, lower, or **No access to this base**); **Reset** returns to the workspace
  role. Workspace owners always keep full access. Migration `0079_base_access_overrides.sql`
  allows the base role `none`.
- **Invite to several bases at once.** "Selected bases only" with a tick list per workspace; one
  invitation (and one email) opens all of them (`POST /v1/invitations` accepts `baseIds`).
- **Change many rows at once** in a member's access table: tick rows, pick a role or No access,
  Apply to selected.
- **Notifications on the Home page** and **desktop notifications**: the bell is on Home too, checks
  every 15 seconds, and after "Turn on" new notifications also appear as desktop notifications
  (old ones are never replayed).

### Fixed
- **Help → Back stepped through every topic you read.** Topics replace each other in the history,
  so Back returns to the page you opened Help from.
- **Importing a CSV with columns named like existing fields** (Notes, Attachments, Record ID)
  stopped with "New field names must be unique". Matching columns are now highlighted (with a
  banner naming them) and each one gets its own choice: import into the existing field, import
  as a new field with a name you choose, **replace** the existing field (it is deleted, and
  Undo brings it back), don't import it, or pick a different field. Options that can't work are
  greyed out with the reason (an attachment field can't take text; the primary field can't be
  deleted). **Rename them for me** still fixes every name clash at once.
- The base collaborator list counted expired grants.

## [0.10.0] - 2026-10-14

### Added
- **Expand attachment cells.** Select an attachment cell and click ⤢ to open all its files large:
  open, download, delete, drag to reorder, and add files with the button or by dropping them.
- **Device approval notifications.** When a member signs in from a new device that needs approval,
  the organization owner gets a bell notification (name, email, device, IP) that opens
  Members & access → Devices.
- **Time zones for date fields.** Date and time, Created time and Last modified time fields have
  "Use the same time zone for all collaborators" with a picker grouped into GMT, United States,
  Europe and Asia & Pacific (plus every other zone), and "Display time zone", which shows the
  zone after the time (EDT, CET, GMT+5).

### Fixed
- **Last modified time was empty for records edited before the field existed.** Watching
  specific fields now fills existing records from the change history (or the creation time when
  the value was set on create), and recomputes when the watched fields change. Migration
  `0078_modified_time_backfill.sql` fills fields that already existed.
- **Download did nothing for files in cloud storage.** Attachments now carry a `downloadUrl` on
  TableOS itself that saves the file under its name (Google Cloud Storage links are signed with
  a download disposition).
- **Filter values couldn't be edited once chosen.** Only the chips were clickable, and the middle
  of the box was the first chip's ×. The option/collaborator picker now fills the whole value
  cell and shows ▾, so clicking anywhere opens the list.
- Date formats other than Local used the viewer's date even when a field had its own time zone.

## [0.9.1] - 2026-10-14

### Fixed
- **Automations didn't run on the live site.** The automation engine (outbox consumer, scheduler
  and executor) only started in the worker process, and production runs just the API. The API now
  starts the engine too (it takes an advisory lock and claims runs with `SKIP LOCKED`, so a worker
  alongside it is safe). Set `AUTOMATIONS_IN_API=false` to leave it to a dedicated worker.
  After an outage the engine catches up on the last hour of changes only, so it never acts on
  day-old edits.
- **Leaving Automations lost your place.** Switching to Data and back reopened the Edit tab.
  The open automation, Edit/Run history tab, selected step and expanded run are now remembered
  for the browser tab.
- **Automation conditions were unreadable in the side panel.** In narrow places each condition
  becomes a small card (field and operator, then the value); inside a nested group the field,
  operator and value each get their own line, and the add buttons wrap.

### Added
- **Airtable-style scripts.** `base.getTable(name)`, `table.selectRecordsAsync()`,
  `createRecordAsync`, `updateRecordAsync`, `deleteRecordAsync` (and the plural forms),
  `record.name`, `record.getCellValue()` / `getCellValueAsString()`.
- **Script input variables.** Name values (with tokens such as the trigger record's Name) and read
  them with `let { recordId, name } = input.config();`. `recordId` is always the trigger record.

## [0.9.0] - 2026-10-13

### Added
- **Field permissions.** Field header menu → **Edit field permissions** limits who can edit a
  field's values: Editors and up (default), Creators and up, Specific users, or Nobody. Everyone
  with access still sees the values. The server enforces it for the app, the API and imports
  (`403 FIELD_PERMISSION_DENIED`); automations and restores are not limited. New
  `PUT /v1/bases/:baseId/tables/:tableId/fields/:fieldId/permissions` (needs schema rights).
  Migration `0077_field_edit_permissions.sql`.
- **Search finds columns by name.** Matching column headers are highlighted, the grid scrolls to
  the first one, and a bar names them. If no cell contains the text, all records stay visible.
- **Record activity menu** (from 0.8.0): All activity, Revision history only, Comments only, and
  comment filters, plus a bell to follow a record's comments.
- **One-row filter conditions** (from 0.8.0): Where | field | operator | value | delete | drag,
  "Add condition group" and "Copy from another view".

### Fixed
- **Searching a large table sent you back to the sign-in page.** A busy or failing database
  during the session check returned 401, which the app treats as signed out. It now returns
  `503` and the app retries; you stay signed in.
- The search box waits until you stop typing (300 ms) instead of querying the whole table on
  every keystroke, and a session's "last seen" time is written at most once a minute instead of
  on every request.

## [0.8.2] - 2026-10-13

### Fixed
- **Sign-in and sign-up failed in production** ("The server is unavailable right now") with
  `column "cookie_refreshed_at" of relation "sessions" does not exist`. The 0.8.0/0.8.1 code was
  deployed, but migration `0076_sessions_no_expiry.sql` was never applied to the production
  database.

### Changed
- **The API applies pending migrations when it starts**, before it accepts requests. A Postgres
  advisory lock makes sure only one instance migrates when several start together. If a
  migration fails, the API exits instead of serving with a mismatched schema (on Render the
  previous deploy keeps running). Set `MIGRATE_ON_START=false` to opt out.
- A failed migration now reports which file failed.

## [0.8.1] - 2026-10-13

### Reverted
- Everything in 0.8.0 except "Sessions no longer expire". The record activity panel, filter
  builder, views sidebar, view switcher, confirmation dialogs and Slack channel listing are back
  to their 0.7.0 behaviour.
- Migration `0075_comment_threads.sql` stays in place. Its columns are unused but harmless, and
  keeping it means databases that already ran it match fresh ones.

### Kept
- Sessions don't expire (migration `0076_sessions_no_expiry.sql`, a 400-day cookie renewed daily).

## [0.8.0] - 2026-10-13

### Added
- **Record activity menu** (Airtable style): All activity, Revision history, All comments, Record
  comments, Comments on attachments, Comments with attachments, and Show resolved comments.
  History and comments share one timeline, oldest first, with the composer docked at the bottom.
- **Resolve comment threads** (`POST /v1/bases/:baseId/comments/:commentId/resolve`). Resolved
  threads are hidden unless "Show resolved comments" is on.
- **Attachments in comments.** Upload or paste files into a comment, or comment on one of the
  record's attachments ("On <filename>"). Comments may be empty when they carry files.
- **Per-record notifications** (the 🔔 menu): All comments, Only @mentions and replies, or Off
  (`GET/PUT …/records/:recordId/subscription`). Commenting subscribes you to all comments.
- **Filter: Copy from another view**, drag handles to reorder conditions, and a delete button on
  every condition.
- **In-app confirmation dialogs** replace the browser's `confirm()` boxes (disconnecting
  accounts, deleting forms, share links, removing members, revoking tokens).
- Migrations `0075_comment_threads.sql` and `0076_sessions_no_expiry.sql`.

### Changed
- **Sessions no longer expire.** You stay signed in until you sign out, an admin removes you, or
  the session is revoked. The cookie is renewed daily (400-day browser maximum). Existing
  sessions were extended. Automation sessions stay short-lived.
- **Filter conditions sit on one row:** Where | field | operator | value | delete | drag.
- **Views sidebar** matches Airtable: "+ Create new…" at the top (a popover with Collaborative /
  Personal and the view types), "Find a view" with a settings menu (expand or collapse all
  sections), ★ My favorites, collapsible My personal views and Collaborative views, an owner
  badge on personal views, and a grey active row.
- The view switcher shows whether the view is personal (👤) or collaborative (👥), followed by a ⌄
  chevron.

### Fixed
- **Slack channels failed to load** with "The Slack app is missing a permission" when the app
  didn't have the optional `groups:read` scope. Public channels now load, with a note on how to
  add private ones. If listing still fails, you can type a channel name or ID.

## [0.7.0] - 2026-10-13

### Added
- **Interfaces: charts.** Bar, horizontal bar, line, area, pie and donut charts. Hover tooltips,
  value labels, legends, up to four values per chart (count, sum, average, min, max), "nice" axis
  ticks and support for negative numbers. Pie charts group small slices into "Other".
- **Interfaces: date buckets.** A date x axis can be grouped by day, week (Monday start), month,
  quarter or year (`groupBy[].bucket` in the aggregate query). Empty periods are filled with zero,
  and undated records are reported under the chart.
- **Interfaces: Date filter element** (`date_filter`) with presets (all time, today, last 7/30/90
  days, this/last month, this year) and a custom from–to range. Elements on the page that use the
  same table receive it as `context.dateRanges` on their queries.
- **Wrong-password policy** for accounts and password-protected shared links. Attempts 1–2 show
  the usual message; attempts 3–4 warn how many are left; attempt 5 locks for 15 minutes
  (`423 ACCOUNT_LOCKED` with `retry-after`). The sign-in page shows a live countdown.
  The organization owner's own account is exempt.
- **Owner alerts.** Every wrong password sends the organization owners an in-app notification and an
  email with the email address tried, IP address, browser, time and attempt number. Locks
  are recorded as the `auth.account_locked` audit event.
- **IDs in the URL.** Routes are `/bases/bas_…/tbl_…/viw_…` and `/bases/bas_…/tbl_…/viw_…/rec_…`
  when a record is open. Old `/bases/bas_…` links still work.
- **Import into an existing table:** unmatched columns default to **New field**, with **Import
  all** and **Don't import any** buttons. New number fields take their precision from the file.
- **Views sidebar toggle** (☰ in the view toolbar). The choice is remembered.
- **Versioning:** `GET /v1/version`, an `x-tableos-version` response header, `version` in
  `/health`, the version in Help and the account menu, the in-app release notes and
  `scripts/version.mjs`.

### Changed
- The browser sends its time zone (`X-Time-Zone`) and the server keeps the user's time zone in
  sync, so date filters and buckets match what the user sees.
- Interface chart and grouping pickers accept every groupable field type (collaborator, text,
  email, phone, URL, number, currency, percent, rating, link and date types).

### Fixed
- The grid header row has its bottom border again.
- Imported decimal numbers no longer show as `-0` or get rounded away.
- Metrics show `0` instead of a blank when no records match.

## [0.6.0] - 2026-10-12

Commits `6b02324`..`edc767f` on the `Awais-Improvements` branch.

### Added
- Attachments are uploaded to Google Cloud Storage through the API and open in an in-app viewer.
- Column menu: **Set as primary field**.
- Last modified time fields can watch all editable fields or specific fields.
- Automation tests use the grid-selected record, accept a pasted record ID or link and show
  readable record labels; script steps can insert values from earlier steps.

### Changed
- New tables start with Record ID as the primary field (no Name/Status/Assignee). Imports keep
  Record ID primary, and the 2,000-record import cap is removed.

### Fixed
- The database layer no longer crashes when a checked-out connection drops.
- Assorted UI issues.

## [0.5.0] - 2026-10-08

Commit `1a5e05d`.

### Added
- Owner-controlled access: only the owner invites people and sets workspace or base roles, with
  access end dates, suspend and remove.
- Device approval, API access tokens, synced tables (other bases, HubSpot, Airtable, Gmail),
  Slack and Gmail automation steps.
- Help & documentation centre.

## [0.4.0] - 2026-10-07

Commit `e7153c7`.

### Added
- Interfaces builder, Forms studio, an always-on Record ID field and visible view creation.

## [0.3.0] - 2026-10-07

Commit `ae4d7df`.

### Added
- Table-bar overflow, Record ID filters, import retries and TableOS branding.

## [0.2.0] - 2026-10-07

Commits `f5b219e`..`eb98bf1`.

### Fixed
- Fix pass across the query engine, sharing and public app, attachments, import/export, search,
  notifications, automations, auth/MFA/invites, permissions, grid editing, calendar and kanban.

### Added
- Record revision history; grid row numbers follow view order.

## [0.1.0] - 2026-10-06

Commit `0f31f5e`: the baseline snapshot.

[Unreleased]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1/releases/tag/v0.1.0
