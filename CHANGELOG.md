# Changelog

All notable changes to TableOS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). See [docs/VERSIONING.md](docs/VERSIONING.md)
for how releases are cut. The same notes appear in the app under
**Help → Release notes** (`apps/web/src/features/help/releases.ts`).

## [Unreleased]

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
