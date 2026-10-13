# TableOS — complete work log

TableOS is an Airtable-style product: workspaces → bases → tables → fields / records / views, plus automations, interfaces, forms, sharing, import/export and realtime collaboration. This document records everything built and fixed so far, newest first, with how each piece was verified.

* Repo: <https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1> (earlier: <https://github.com/marslanalvi/tableosv1claudeincursor>)
* Branches: `master` (released), `Awais-Improvements` (feature work, merged into `master` for v0.8.0)
* Current version: **0.9.0**. Release history in `CHANGELOG.md`; the release process is in `docs/VERSIONING.md`.
* Architecture source of truth: `architecture/` (mirrored in `docs/architecture/`). Amendments made during this work are summarised in `00-canonical-decisions.md` §15.

---

## How to run it locally

| What | Value |
|---|---|
| Stack | Node 22, pnpm 9.15 monorepo; Fastify + Kysely (Postgres); React 19 + Vite + TanStack Query |
| Isolated dev ports | API `3200`, realtime `3202`, web `5283`, public app `5284` |
| Database | `DATABASE_URL` in the root `.env` (not committed). Since v0.9.0, local and live share the Render database `tableos_3yok`; locally use the External URL with `?sslmode=verify-full` |
| Migrate | `npx pnpm@9.15.0 db:migrate` (reads `.env`); the API also migrates on start |
| Typecheck | `npx tsc -p apps/server/tsconfig.json --noEmit` and `npx tsc -p apps/web/tsconfig.app.json --noEmit` |
| Unit tests | `npx pnpm@9.15.0 --filter "@tabula/filter" --filter "@tabula/formula" test` (and other packages' `test`) |
| API checks | `node .data/verify-interfaces.mjs`, `node .data/verify-round.mjs`, `node .data/verify-access.mjs`, `node .data/verify-sync.mjs`, `node .data/verify-r7.mjs`, `node .data/verify-r9.mjs` |
| UI checks | `$env:PW_VIEWPORT="1366x768"; node .data/r2-shell/pw.mjs .data/r2-shell/look-interfaces.mjs` (screenshots in `.data/r2-shell/shots/`) |

---

## v0.9.0: field permissions, search by column name, no logout while searching

* **Field permissions** (Airtable's "Field permissions"):
  * Stored in `data.fields.edit_permission` (jsonb, migration 0077). `null` means Editors and up. The other levels are `creators`, `specific` (with `userIds`) and `nobody`.
  * `apps/server/src/modules/schema/field-permissions.ts` holds the rules. `records/write.ts` checks them in `createRecordsInTx` / `updateRecordsInTx` for writes via `ui`, `api` and `import`, and fails with `403 FIELD_PERMISSION_DENIED`.
  * Set with `PUT …/fields/:fieldId/permissions`, which needs schema rights.
  * The field DTO, including `GET /v1/bases/:id`, carries `editPermission`.
  * UI: field header menu → **Edit field permissions** (`FieldPermissionsDialog.tsx`). The grid and record drawer make restricted fields read-only for people who can't edit them.
* **Search:**
  * The toolbar search is debounced by 300 ms in `routes/table-grid.tsx`.
  * `GridView` matches column names: it highlights the headers, scrolls to the first match, and shows a "Matching field" bar. A one-row probe query checks whether any cell matches. If none does, all records are shown.
* **"Search sends me to login":**
  * `http/auth-hook.ts` returned 401 when the session lookup itself failed (busy database or pool timeout), and the app treats 401 as signed out. It now returns `503 SERVICE_UNAVAILABLE`.
  * `last_seen_at` is written at most once a minute, so parallel requests don't queue on the session row.
* Also back from 0.8.0: the record activity menu and comment subscriptions, and the one-row filter builder.
* **Verified:**
  * `node .data/verify-r9.mjs`: 25 checks, covering permissions for an editor, the owner and a listed user, validation, and a burst of 20 searches and app calls on an 8,500-row table with no 401.
  * `.data/r2-shell/r9-look.mjs`: browser check of search highlighting, the permissions dialog, specific users, the editor's read-only cell and the filter.
  * All earlier verify scripts and the lockout test pass.

---

## v0.8.2: production sign-in fix, migrations on startup

**Symptom:** in production, sign-in showed "The server is unavailable right now". The API logged `column "cookie_refreshed_at" of relation "sessions" does not exist` from `createSession`.

**Cause:** v0.8.0/v0.8.1 was deployed, but migration `0076_sessions_no_expiry.sql` was never run on the production database. Nothing in the deploy applied migrations.

**Fix:**
* `apps/server/src/entrypoints/api.ts` runs `runMigrations()` before `createApp()`, unless `MIGRATE_ON_START=false`. If a migration fails, the process exits.
* `packages/db/src/migrate.ts`:
  * holds `pg_advisory_lock` for the whole run, so concurrent instances migrate once;
  * returns the files it applied;
  * names the failing file in errors.

**Process from now on:** release work goes to a `release/vX.Y.Z` branch. The owner previews and approves it before anything is merged into `master`.

**Verification:**
* `.data/r8-prep-db.mjs` builds `tabula_r8`, a database without 0076, like production.
* The production bundle (`node dist/api.js`) with `MIGRATE_ON_START=false` reproduces the exact error: signup and login return 500.
* With the default setting it applies 0076, and signup 201, login 200, `/me` 200. A second start reports "database is up to date".
* `.data/r8-concurrent.mjs`: three concurrent runs apply the migration exactly once.
* All verify scripts and `r6-lockout.mjs` pass. That test's "owner got in-app alerts" check used to compare the size of the capped 50-item notifications page; it now looks for new alert IDs.

---

## v0.8.1: Round 7 reverted, except sessions

At the owner's request, every Round 7 change except "sessions never expire" was undone: the files were restored from v0.7.0 (`ff1b094`). Kept:
* `auth/session.ts`
* `http/auth-hook.ts`
* migration `0076_sessions_no_expiry.sql`
* the Help note on sessions

Migration `0075_comment_threads.sql` stays, so databases that already ran it match fresh ones. Its columns are unused.

Round 7 below describes v0.8.0, which is no longer the current behaviour.

---

## Round 7 (v0.8.0, reverted in v0.8.1 except section 3): record activity, one-row filters, Airtable-style views sidebar, sessions without expiry, Slack fixes

### 1. Record activity (Airtable's activity menu)
* **Migration `0075_comment_threads.sql`:**
  * `data.comments` gains `resolved_at`, `resolved_by`, `attachment_ids uuid[]` and `target_attachment_id`.
  * `data.record_subscriptions` gains `level` (`all` | `mentions` | `off`).
* **API (`modules/comments/routes.ts`):**
  * Comments may carry up to 10 attachments of the base (an empty body is allowed only then), and can target one of the record's attachments.
  * `POST /v1/bases/:baseId/comments/:commentId/resolve {resolved}` works on top-level threads.
  * `GET/PUT …/records/:recordId/subscription {level}`. Without a row the level is `mentions`; commenting stores `all`.
  * Notifications respect the level, and the collab worker only notifies `level = 'all'` subscribers about edits.
* **Web:**
  * `RecordActivity.tsx` has the "All activity ⌄" menu (All activity, Revision history, All comments, Record comments, Comments on attachments, Comments with attachments, Show resolved comments) and the 🔔 notify menu. Both choices are remembered in local storage.
  * `RecordComments.tsx` merges history and comment threads into one timeline (oldest first), with a docked composer (📎 upload, paste/drop, "On <filename>" target), Resolve/Reopen, and an in-app delete confirmation.

### 2. Filter builder
* Each condition is one row: `Where`/conjunction | field | operator | value | 🗑 | ⠿ drag handle (`FilterBuilder.tsx`, `views.module.css`).
* Nested groups get their own header and delete button.
* Footer: + Add condition, + Add condition group, and **Copy from another view** (`CopyFilterFrom`).

### 3. Sessions never expire
* **Migration `0076_sessions_no_expiry.sql`:** adds `cookie_refreshed_at`, and extends live user sessions to 100 years (absolute and idle).
* `createSession` writes 100-year expiries and sets a 400-day cookie.
* `auth-hook.ts` stops sliding the 24-hour idle window and re-issues the cookie at most once a day (`setSessionCookie`).
* Sign-out, password change, admin removal and revocation still end sessions. Automation service sessions stay at 15 minutes.

### 4. Views sidebar and switcher
* `ViewsSidebar.tsx`:
  * a "+ Create new…" popover (Collaborative/Personal and the view types);
  * 🔍 Find a view, with a ⚙ menu (expand or collapse all sections; the open/closed state is persisted in `tableos.views.sections`);
  * ★ My favorites, then ⌄ My personal views and ⌄ Collaborative views (counts show only while a section is collapsed);
  * owner-initial badges on personal views, and a grey active row.
  * The bottom "Create…" panel is gone.
* `ViewToolbar.tsx`: the switcher shows a 👤/👥 icon and a ⌄ chevron instead of the "Personal" badge.

### 5. Confirmations and Slack
* `askConfirm()` / `<ConfirmHost/>` (`app/ui.tsx`, mounted in the root route) replace every `window.confirm`:
  * disconnecting accounts (`confirmDisconnect` is now async);
  * deleting forms;
  * disabling or regenerating share links;
  * removing members;
  * revoking API tokens.
* `SlackClient.channels()` retries with public channels only when `conversations.list` returns `missing_scope` (no `groups:read`), and returns `privateListed`. The channel picker explains how to add private channels, and keeps the manual name/ID input when listing fails.

### Verification
* Server, web and public typecheck clean.
* `verify-access`, `verify-sync`, `verify-round`, `verify-interfaces` and `r2-shell/r6-lockout.mjs` pass.
* New `.data/verify-r7.mjs` passes: cookie max-age of 400 days, no-expiry session rows, resolve/reopen, empty comment rejected, subscribe-on-comment, default `mentions`, level `off` saved, invalid level rejected.
* `.data/r7-slack-scope.ts` (mock Slack) passes: without `groups:read` the step lists public channels with `privateListed: false`; with it, both kinds of channel.
* Screenshots (`r2-shell/r7-sidebar-look.mjs`, `r7-confirm-activity.mjs`): sidebar, create popover, one-row filter, in-app confirm and activity menu.

---

## Round 6 (v0.7.0): import defaults, IDs in URLs, views sidebar, interface dashboards, wrong-password policy, versioning

Built on top of the `Awais-Improvements` branch (v0.6.0: GCS attachments, Record ID primary, automation test improvements), then merged into `master`.

### 1. Import into an existing table
* Columns without a matching field now default to **+ New field** instead of "Don't import" (`ImportWizard.tsx`).
* **Import all** (match existing fields, create the rest) and **Don't import any** buttons above the mapping list.
* New number fields get `config.precision` from the file (`decimalsIn`, up to 8 places, `.` as the decimal separator), so values such as `-0.0079` no longer show as `-0`.

### 2. Grid header border
* The header row has its bottom border again (`grid-view.module.css`).

### 3. IDs in every URL
* `lib/base-url.ts` reads and writes `/bases/bas_…/tbl_…/viw_…[/rec_…]`; the router has a splat route `/bases/$baseId/$`.
* Switching table or view, and opening a record, push a history entry (automatic redirects replace it), so Back steps through them. Closing a record removes `rec_…`. Old `/bases/bas_…` and `?table=…&record=…` links still resolve.

### 4. Views sidebar collapse / expand
* A ☰ button with the view name at the start of the view toolbar hides and shows the views sidebar, like Airtable. The state is saved in `localStorage`.

### 5. Interfaces: charts, date buckets, date filter
* **Server.** `group-query.ts` buckets date and datetime fields by day / week / month / quarter / year (`to_char(date_trunc(…))`, datetime in the user's time zone). `interfaces/model.ts` adds chart kinds `hbar` and `area`, `x.bucket`, `x.limit` up to 400 and the `date_filter` element, and validates that bucketed and filter fields are dates. `interfaces/routes.ts` accepts `context.dateRanges` (`YYYY-MM-DD`) and ANDs them into collection and aggregate queries. A bucketed chart sorted by label keeps the latest periods when it hits the limit.
* **Web.** `Charts.tsx` (new) draws bar / line / area (several series, negative values, nice ticks, value labels, tooltips), horizontal bar and pie / donut (top 8 plus "Other", centre total). Empty periods across the selected range are filled with zero, and undated records are noted. The inspector has kind, x field, "Group dates by", up to four values (count / sum / avg / min / max), sort, limit, value labels and legend. The `DateFilterElement` has presets and a custom range.
* **Time zone.** The browser sends `X-Time-Zone` and `auth-hook.ts` keeps `core.users.time_zone` in step, so "January" means January in the viewer's zone.
* **Demo dashboard.** "SMS analytics" on the *Twilio SMS demo* base (Table 1, 2,982 records, Sep 2025 to Oct 2026) has Overview, Trends and Delivery issues pages. Built by `.data/r2-shell/r6-dash.mjs`, which probes every aggregate with and without a date range (20/20 OK). Screenshots come from `r6-dash-look.mjs` (`shots/dash-*.png`).

### 6. Wrong-password policy (`modules/auth/lockout.ts`)
* 5 attempts in 15 minutes. Attempts 1–2 return the normal 401. Attempts 3–4 add "Warning: N attempts left…" with `meta {attempt, remaining}`. Attempt 5 returns `423 ACCOUNT_LOCKED` with `retry-after` and a 15-minute lock. A correct password clears the count.
* Applies to sign-in (including unknown emails, so accounts can't be probed) and to password-protected shares (keyed per share + IP, via both the `x-share-password` header and `/unlock`).
* **Owner exempt:** users who own their organizations and are not a member of anyone else's org are not locked; the share owner, when signed in, is not locked on their own shares. The general limit (10 per 15 minutes per account + IP) still applies.
* **Alerts:** every wrong password sends a system notification and an email to the owners of the orgs involved, with the email, IP, browser, time and attempt number. A lock is also audited as `auth.account_locked`.
* The login page shows the warning in amber, then a live "Locked · m:ss" countdown. The public share page shows the same messages.
* Verified by `.data/r2-shell/r6-lockout.mjs` (26/26) and `r6-login-look.mjs` (screenshots `login-warning.png`, `login-locked.png`).

### 7. Versioning
* One SemVer version for the root and all apps, set with `node scripts/version.mjs <x.y.z|major|minor|patch>`.
* The server exposes `GET /v1/version` (public), `version` in `/health` and an `x-tableos-version` header. The web app gets `__APP_VERSION__` / `__APP_COMMIT__` from Vite and shows them in the Help sidebar, the account menu ("What's new") and **Help → Release notes**.
* `CHANGELOG.md` covers v0.1.0–v0.7.0, and `docs/VERSIONING.md` describes the policy and release steps. Git tags `v0.1.0`–`v0.7.0` mark each round.
* Help topics were updated: IDs in the address bar, the views sidebar toggle, import defaults, charts and date filters, share password attempts, the new "Sign-in security" topic and the API's 423 / version.

---

## Round 5 (commit `1a5e05d`): owner-controlled privileges, device approval, API tokens, cross-base data, table ids, Help centre

### 1. Privileges: only the owner manages access

* **Owner-only management.** Inviting, changing roles, ending access, suspending/removing members, approving devices and creating API tokens all require the organization owner (`isOrgOwner`). Other members get `403`. The owner's own membership can't be changed (`409`).
* **Members & access page** (`/admin`, account menu → "Members & access"; `features/admin/AdminPage.tsx`) with four tabs:
  * **People:** invite to a whole workspace or a single base with a role; pending invitations; per-member access table (role per workspace and per base, plus an optional "Access until" date); Suspend / Reactivate / Remove.
  * **Devices**, **API tokens**, **Security** (below).
* **Server:** `apps/server/src/modules/members/routes.ts` (`GET /v1/orgs`, `GET /v1/orgs/:orgId/access`, `PUT …/members/:userId/grants`, `PATCH`/`DELETE …/members/:userId`, device and token routes). Grant changes bump `perm_epoch` and drop the permission snapshot caches, so they apply to signed-in users at once. Grant expiry (`expiresAt`) is enforced when permissions are compiled.
* The workspace Share dialog no longer offers "Owner" as an invite role and points to Members & access.

### 2. Device approval (replaces MAC-address restriction)

Browsers can't read a MAC address, so each browser gets a random device key in a long-lived httpOnly cookie (`tableos_device`); only its SHA-256 is stored (`core.org_devices`, migration `0068_access_control.sql`).

* In an org that requires approval (the default; toggle in **Security**), a non-owner's new device starts `pending`. That org's data is unreachable from it until the owner approves it. The owner is always exempt.
* The member sees a banner (`DeviceBanner.tsx`, polling `GET /v1/devices/current`) that unlocks automatically once approved.
* The owner can approve, deny, revoke, rename or forget devices. Checks run centrally on every request (`access/devices.ts`, request context `access.blockedOrgs`), with a 15 s cache that is invalidated when an invitation is accepted or a device decision is made.

### 3. API tokens with read / write / delete types

* Owner-only, in **Members & access → API tokens**: name, any combination of **read**, **write**, **delete**, all bases or chosen bases, optional expiry. The raw token (`tos_…`) is shown once; only its hash is stored (`core.api_tokens`).
* `Authorization: Bearer tos_…` is accepted by the auth hook. `access/api-tokens.ts → requiredScope` limits tokens to the record API and schema reads and maps each method/path to the needed scope; tokens act with the owner's permissions, narrowed by scope and base list.
* **Table-id-only API:** `/v1/tables/:tableId/…` resolves the base and forwards to `/v1/bases/:baseId/tables/:tableId/…` (`public-api/routes.ts`); `GET /v1/api/bases` lists reachable bases and tables.
* `kernel/mutation.ts`: token writes have no session, so `session_id` is stored as `NULL` (it was `""`, which failed the uuid column).

### 4. Data from other bases: synced tables and cross-base links

* **Synced tables** (`modules/sync/`, migration `0069_table_syncs.sql`): a read-only copy of another base's table in the same org.
  * The engine (`engine.ts`) maps field types (computed fields become their result type, attachments become text, buttons are skipped), reconciles schema (create, rename, retype, delete) and copies records by content hash in batches of 500.
  * The worker (`scheduler.ts`) re-syncs about 2 s after the source table changes, plus a sweep every minute for syncs that are due (default every 5 minutes).
  * Syncs run with the creator's read access to the source; losing access puts the sync in `error`.
  * Synced fields and records are read-only (`guard.ts`, `403`), but you can add your own fields to a synced table. "Stop syncing" turns it into a normal table.
  * UI: "Sync from another base" in the add-table menu and dialog, ⇄ tab badge, a sync bar (last sync, Sync now, Pause/Resume) and tab-menu actions.
* **Cross-base links:** a link field can target "a table in another base" (`FieldDialog.tsx → CrossBaseLinkPicker`). It creates or reuses a synced copy and links to it, so lookups and rollups work unchanged.

### 5. Table ids

Table ids were already globally unique UUIDv7 public ids (`tbl_…`), unique across all bases. They are now visible: the table tab menu → **IDs & API…** shows the base, table and field ids with copy buttons and a `curl` example. The expanded record has **Copy record ID**.

### 6. Record ID hidden by default in new views

New views (and a new table's first view) hide Record ID fields; they can be shown from **Fields** (`bootstrap-default-table.ts`, view creation defaults).

### 7. Help centre

`/help/:topic` (account menu → "Help & documentation"; readable signed out) with search and 20 topics: getting started, IDs, fields (list generated from `FIELD_TYPES`), editing records, views, links/lookups/rollups, synced tables, formulas, import/export, forms, interfaces, automations, sharing, search/notifications/contacts, roles and privileges, device approval, account/2FA, API tokens, API reference with examples and errors, and keyboard shortcuts (`features/help/`).

### Verified

* Typecheck: server and web clean.
* `node .data/verify-access.mjs`: 39 checks covering owner-only management, grant expiry, suspend/remove, device approval, and token scopes, base limits and revocation.
* `node .data/verify-sync.mjs`: initial sync, live updates via the worker, renamed/deleted fields and records, read-only guard, links and lookups to a synced table, pause, stop syncing, and refusal for a source you can't read.
* `verify-round.mjs` and `verify-interfaces.mjs` still pass.
* Playwright: `.data/r2-shell/r5-look.mjs` (Help pages, search, account menu, every Members & access tab) and `r5-crossbase.mjs` (link to a table in another base from the field dialog).

## Round 4: Record ID field, "Fields" panel, view creation, Forms studio, Interfaces (commit `e7153c7`)

### 1. Record ID is a real, visible, hideable field on every table

Every record already had a unique public id (`rec_…`). It is now shown as a field.

* **New tables** get a **Record ID** field automatically (`apps/server/src/modules/base/bootstrap-default-table.ts`).
* **Existing tables** were backfilled: migration `0064_record_id_on_every_table.sql` adds a Record ID field to every live table that lacks one (named "Record ID (system)" if "Record ID" is taken), appended after the existing fields.
* `0065_record_id_field_uuidv7.sql` re-keys those field ids to UUIDv7. The first version of 0064 used `gen_random_uuid()` and broke `GET /v1/bases/:id` with a 500 ("encodePublicId requires a UUIDv7"). 0064 itself now uses `public.uuidv7()`.
* **Hide, but don't lose it:** it appears in the view's **Fields** panel and can be hidden per view like any field. The server refuses to delete or change the type of a table's last Record ID field (`409 RECORD_ID_REQUIRED`, `field-ops.ts → assertNotLastRecordIdField`).
* **Filtering by Record ID** (exact match, contains, starts with…) works through the virtual field `__record_id__`. Exact matches were silently returning nothing because SQL `data.encode_public_id` used numeric `/`, which rounds. `0067_encode_public_id_div.sql` switched it to `div`/`mod`, so SQL and JS ids now match.

### 2. "Hide fields" is now "Fields"

`ViewToolbar.tsx`: the toolbar button and its popover are titled **Fields**. The button reads `Fields · N hidden` when some fields are hidden.

### 3. Creating a view is always visible

Previously the only entry point was a "Create…" popover at the bottom of the views sidebar, which was easy to miss. There are now three entry points:

1. **Toolbar view switcher.** Click the view name in the toolbar to see every view of the table (current one ticked) and a **Create a view** section with every type (Grid, Form, Calendar, Gallery, Kanban, Timeline, List, Gantt).
2. **`+` button** next to "Find a view" in the views sidebar.
3. The sidebar **Create** list is now inline, open by default, and remembers whether it is open or collapsed (`localStorage`).

New views are collaborative for owners, creators and editors, and personal for everyone else. Files: `ViewToolbar.tsx`, `ViewsSidebar.tsx`, `views-sidebar.module.css`, `views.module.css`, `routes/table-grid.tsx`, `routes/base.tsx`.

### 4. Forms tab works as a full form studio

`apps/web/src/features/views/FormsIndex.tsx` was rewritten as a two-pane studio:

* **Left:** all form views across all tables, with a table picker, **+ New form**, search (when there are more than 3 forms) and question counts.
* **Right:** the full form builder with live preview (the same `FormView` used in the Data tab). It also has **Copy public link** (creates a form share link), **Open in Data** and **Delete form** (with confirmation).

### 5. Interfaces (architecture 13), from "Coming soon" to working

**Backend.** Migration `0066_interfaces.sql` adds `data.interfaces`, `data.interface_pages` and `data.interface_versions`. The server code is in `apps/server/src/modules/interfaces/`:

* `model.ts` defines the page and element schemas (Zod) and validates references for publishing.
* `routes.ts` provides the REST API, registered in `http/app.ts`.

| Capability | Endpoint(s) |
|---|---|
| List / create / rename / delete interfaces | `GET/POST /v1/bases/:b/interfaces`, `PATCH/DELETE /:itf` |
| Pages (add, rename, edit layout, delete, reorder) | `/:itf/pages…`. Edits take `expectedRevision`; a stale save gets `409 PAGE_REVISION_CONFLICT`, and deleting the last page gets `409 LAST_PAGE` |
| Publish (validated snapshot) | `POST /:itf/publish`. Errors return `422 INTERFACE_INVALID` with diagnostics; warnings are returned with success |
| Unpublish, version history, restore to draft | `POST /:itf/unpublish`, `GET /:itf/versions`, `POST /:itf/versions/:n/revert` |
| Published runtime | `GET /:itf/runtime` (`410` when unpublished) |
| Element data | `POST …/elements/:elm/query` (records, projected to the element's fields only) and `POST …/elements/:elm/aggregate` (number and chart values computed on the server) |

Security properties:

* Builders (`base.manage_schema`) see drafts. Everyone else sees only the published snapshot.
* Element queries apply the element's own table, view, filter and sort on the server, so the client cannot widen them.
* **Record details** re-checks that the selected record is visible through the source element (`RECORD_NOT_IN_SCOPE`).
* The element query and aggregate POSTs are read-only, so they are excluded from idempotency storage (`http/idempotency.ts`).

**Frontend.** The code lives in `apps/web/src/features/interfaces/` and `apps/web/src/lib/api-areas/interfaces.ts`.

* **Interfaces tab:**
  * a sidebar list with a status for each interface (Draft / Published · vN / Unpublished changes);
  * page tabs, with page menus for rename, move left/right and delete;
  * **Edit / Preview / Published** modes.
* **Templates:** Dashboard (title, record count, sum of a number field, a chart grouped by a select field, a grid), Record review (list plus details), Form, and Blank.
* **Elements:**
  * **Number**: count, sum, average, min, max or unique count; number, currency or percent formatting.
  * **Chart**: bar, line, pie or donut, drawn as SVG.
  * **Grid**, **List** and **Gallery**: with search, "Load more", click to select or open, and an optional "+ New record".
  * **Record details**: follows the selection in another element; editable fields save as you type.
  * **Form**: creates records.
  * **Button**: opens an https, mailto or tel link, or goes to another page.
  * **Text**: headings, bullets and bold.
  * **Divider**.
* **Inspector** (per element): title and width, then:
  * **data source:** table, base view, and a filter built with the same builder as views;
  * **fields:** a picker with ordering and Editable / Required flags;
  * **type-specific settings:** chart, number and button options.
* **Saving and publishing:**
  * Autosave is debounced, with conflict detection.
  * **Publish** shows a diagnostics dialog when there are problems.
  * **Version history** can restore any version to the draft.
  * Interfaces can be unpublished.

**Deliberate MVP limits** (recorded in architecture 13 §18):

* Only base members can use interfaces. There are no interface-only users or share links.
* There is no Redis caching or realtime invalidation for aggregates.
* Layout is a single section with flow layout, not free-form drag and resize.
* The only record context is "record selected in another element".

### 6. Other fixes included in this commit (earlier QA pass)

* **Filters:**
  * Filters are capped at 200 conditions (`FILTER_TOO_LARGE` → 422).
  * Validation is a single bounded walk, so deeply nested input can't overflow the stack (`packages/filter/src/parse.ts`, `views/config.ts`, `http/errors.ts`).
* **Personal views are private in queries:** another user's personal view can't be used as `viewId` in record or group queries (`execute-record-query.ts`, `group-query.ts`).
* **Automations:** webhook URLs, which contain the trigger secret, are only returned to users who can manage the base.
* **Workspaces:**
  * Only workspace owners can rename or delete a workspace.
  * Base-only guests no longer see the workspace member list.
  * Guests' workspace lists only include workspaces they have grants in.
* **Undo/redo of linked-record changes** now restores the links (`history/apply-ops.ts`).
* **Formulas:**
  * Added the architecture-08 function names (`CONCAT`, `DATE_DIFF`, `DATETIME`, `TO_TIMEZONE`, `TEXT`, `JSON_GET`, `ARRAY_SORT`, `ROW_NUMBER`, `CREATED_BY`, …), with aliases to the existing implementations.
  * Lone UTF-16 surrogates are sanitised so they can't fail a write.
  * Rollup `AND()` treats unchecked linked checkboxes as false.
* **Select fields:** deleting a select option clears it from cells (`schema/field-ops.ts`).

### Verification for this round

* Server and web typechecks are clean, and the filter (21) and formula (15) unit tests pass.
* `.data/verify-interfaces.mjs` passes all 26 checks:
  * Record ID present on old and new tables, and protected from deletion;
  * Record ID exact-match filter;
  * interface CRUD and pages;
  * revision conflict and last-page guard;
  * element field projection;
  * metric and chart aggregates;
  * record-detail scope check;
  * publish, versions, revert, unpublish (410) and delete.
* `.data/verify-round.mjs` passes: view creation, Record ID virtual filter, built-in Record ID field value, hidden tables, CSV import.
* Playwright (`look-interfaces.mjs`, 1366×768) passed every step with no console errors:
  * create a Dashboard;
  * open the inspector;
  * publish, and switch to the Published view;
  * create a Record review and select a record (details render);
  * add a Form page and submit a record.
* Playwright screenshots confirm the **Fields** label, the Record ID column, the inline Create list, the `+` button and the toolbar view switcher.

---

## Round 3: table bar, Record ID filter, import reliability, TableOS branding (commit `ae4d7df`)

* **Table tabs:**
  * The table bar collapses tabs that don't fit into an overflow menu (`tab-fit.ts`, with unit tests).
  * Tabs have context menus and floating popovers (`floating.tsx`).
  * Each user can hide tables for themselves (`0061_user_hidden_tables.sql`, `table-prefs-routes.ts`).
* **Views sidebar:** create a view in one click from the type list.
* **Record ID criterion** like Airtable's:
  * a `record_id` field type (`0063_record_id_field.sql`, `packages/fields`, `field-ui`);
  * the virtual `__record_id__` filter in the evaluator and SQL compiler;
  * shown in the filter builder.
* **Import:** CSV/XLSX import no longer fails with "Failed to fetch". Import requests now bypass idempotency storage, and the client retries transient failures (`http/app.ts`, `idempotency.ts`, `ImportWizard.tsx`, `lib/api.ts`).
* **Rebrand from Tabula to TableOS** across the web app, public app, emails, OpenAPI title and README.

## Round 2: audit and fix pass (commits `0f31f5e` → `eb98bf1`)

A full audit (`docs/fix-plan/audit-ui.md`, `audit-backend.md`, `audit-contract.md`, with cross-workstream contracts in `CONTRACTS.md`) was followed by fixes across every area.

* **Query engine:**
  * type-aware filters, typed sort and pagination, a record serializer;
  * `fld_` id resolution;
  * 422 errors for bad ids and filters;
  * fixed a group-query 500.
* **Lookups:** filter, sort, search and group by display text.
* **Compute:**
  * stores link-lookup ids and refreshes them when a linked record is renamed;
  * schema integration tests.
* **Grid:**
  * editing fixes, typed dates, menus and popovers;
  * server summary totals and read-only mode for viewers;
  * role-based edits, uploads outside the grid;
  * 10k-row scrolling;
  * row numbers that follow view order.
* **Views:**
  * edit permissions by role, save on unload, retry after load errors;
  * kanban, timeline and form fixes;
  * calendar multi-day bars with move and resize.
* **Record history:** a revision history endpoint and an activity panel.
* **Platform:**
  * sharing and the public app, attachments, import/export, search (primary-field titles, live index sync, a reindex endpoint), notifications, contacts, comments;
  * automations triggered by real events, with lookup conditions;
  * auth, MFA, invites and billing;
  * a permissions sweep and an idempotency fix;
  * account and invite routes.
* **Dev experience:**
  * an isolated dev launcher on ports 3200/3202/5283/5284;
  * the worker and relay load `.env`;
  * fixed the web build and order-key collation;
  * favicons.

## Round 1: baseline

The initial monorepo snapshot. The reconciled architecture document set (`docs/architecture/`, 35 documents) was added on top of it.

---

## Known gaps / next steps

* Interfaces: interface-only users and share links, per-interface permissions, page-record context, drag/resize layout, aggregate caching and realtime refresh (architecture 13 §18).
* Error-code union in `@tabula/types` only lists generic codes; module codes (`PAGE_REVISION_CONFLICT`, `RECORD_ID_REQUIRED`, …) are compared as strings in the web client.
* Test interfaces and records created by the verification scripts live in the dev database (`tabula_cc`) only.
