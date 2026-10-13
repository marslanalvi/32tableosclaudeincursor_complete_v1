# Changelog

All notable changes to TableOS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). See [docs/VERSIONING.md](docs/VERSIONING.md)
for how releases are cut. The same notes appear in the app under
**Help → Release notes** (`apps/web/src/features/help/releases.ts`).

## [Unreleased]

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
