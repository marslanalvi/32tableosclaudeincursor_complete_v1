# TableOS — complete work log

TableOS is an Airtable-style product: workspaces → bases → tables → fields / records / views, plus automations, interfaces, forms, sharing, import/export and realtime collaboration. This document records everything built and fixed so far, newest first, with how each piece was verified.

* Repo: <https://github.com/marslanalvi/32tableosclaudeincursor_complete_v1> (earlier: <https://github.com/marslanalvi/tableosv1claudeincursor>)
* Branches: `master` (released), `Awais-Improvements` (feature work, merged into `master` for v0.8.0)
* Current version: **0.16.0**. Release history in `CHANGELOG.md`; the release process is in `docs/VERSIONING.md`.
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

## v0.16.0: roles phase 3 (two-factor, sessions, share links, Runs as, move base, Activity)

Implements phase 3 of `docs/roles-and-permissions/Roles-Decisions-Questionnaire.md` (G12–G20; B8–B11). G10 (interface-only role) stays postponed per B12.

* **Migration `0083_sessions_mfa_runas.sql`:** sessions idle >30 days end; `platform_settings.require_mfa = true`; `data.automations.run_as` (backfilled with `coalesce(updated_by, created_by)`).
* **Sessions (G12):** `createSession` sets `idle_expires_at = now() + 30 days` (`SESSION_IDLE_DAYS`); the auth hook pushes it out again when it updates `last_seen_at` (at most once a minute; automation sessions excluded). Cookie max-age 30 days, re-issued daily.
* **Two-factor (G13):** `auth/mfa-policy.ts` (`mfaRequired`, cached 5 s; `allowedBeforeMfa`: `/v1/auth/*` except `ws-ticket`, invitation accept, current device, version). The auth hook loads `has_mfa` with the session and answers 403 `MFA_SETUP_REQUIRED` otherwise (automation sessions and API tokens exempt). `/v1/auth/me` returns `mfaRequired`/`mfaSetupRequired`; `/mfa/disable` is refused while required. Web: `ensureAuth(destination)` redirects to `/setup-2fa?next=…` (`SetupTwoFactorPage` reuses `MfaSection`, `required` hides "turn off"); `setMfaSetupHandler` catches a 403 mid-session; `useFinishAuth` invalidates `/me` after sign-in so the flag is fresh. Owner exemptions from lockout and device approval are unchanged (B11).
* **Share links (G14):** create/patch/revoke/rotate need `base.manage_schema`; base detail returns `canShare`; `ShareDialog canManage` disables controls with a note. With `allow_copy` off the public query caps `pageSize` at 50 and `publicRecords` blanks attachment `url`/`downloadUrl`; `SharedView` blocks copy/cut/contextmenu/dragstart.
* **G15:** `canEditFieldValues` / `fieldPermissionAllows`: Owner and Creator always true. **G16:** engine runs as `coalesce(run_as, updated_by, created_by)`; create/duplicate set `run_as`; PATCH `runAsUserId` must be a base Creator (422 otherwise), audited `automation.run_as_changed`; DTO `runAs {id,name}`; `RunAsPicker` in the automation header. **G17:** `/v1/notifications` drops rows (and unread counts) for bases the user can't compile a role for. **G19:** workspace members and base collaborators blank `email` (and hide pending invitations) unless the viewer is Owner/Admin or Workspace Owner; own email always shown.
* **G18:** `POST /v1/bases/:baseId/move {workspaceId}`: Creator of the base, may create bases in the target, same org, and Owner/Admin or Workspace Owner of both. One transaction updates `workspace_id` in every table with `base_id` (`MOVE_TABLES`, checked against the schema by the test), `data.bases`, `core.public_link_directory`; bumps `perm_epoch`. Fixed `PostgresFtsBackend.upsert` to take the base's current workspace (late index events carried the old one). Web: "Move to workspace…" on base cards (`MoveBaseDialog`).
* **G20:** `GET /v1/orgs/:orgId/activity?category&before` (Owners/Admins): audit events of the org or its workspaces with actor and a target label, 100 per page. Web: Members & access → Activity with filter and "Show older".
* **Tests:** `.data/verify-r18-phase3.mjs` (42 checks; toggles `require_mfa` and waits out the 5 s cache), `.data/r18-seed.mjs` + `.data/r2-shell/r18-ui.mjs` (10 checks, screenshots `r18-*.png`). `verify-r7` (30-day cookie/idle) and `verify-r9` (Owner edits "Nobody" fields) updated to the new rules. Local `tabula_cc` keeps `require_mfa = false` for the older suites.
* **Live (read-only, `.data/r18-live-impact.mjs`):** none of the 10 people has two-factor yet, so everyone (Arslan included) is asked to set it up on their next request after deploy; 13 share links (all copy-off) keep working; 50 automations keep their current "Runs as"; no fields set to "Nobody".

## v0.15.0: roles phase 2 (Owner, Admin, Member)

Implements phase 2 of `docs/roles-and-permissions/Roles-Decisions-Questionnaire.md` (G6, G7, G8, G11; B2, B3, B5, B14). Where the questionnaire conflicted, B3 (Admins invite) and B14 (three account types, so no Guest) won.

* **Migration `0082_three_org_roles.sql`:** `billing_admin`/`guest` members become `member`; `organization_members_role_check` and the org part of `access_grants_role_check` allow only `owner`, `admin`, `member`; `core.invitations.org_role` (default `member`).
* **Access:** `orgRoleGrantsWorkspaceOwner` is Owner-only, so Admins get workspaces/bases only through grants (`compile.ts`, `getWorkspaceAccess`, workspace members list, base collaborators). `canManageMember(actor, target, self)` in `workspace-access.ts`: Owners manage everyone, Admins manage Members, nobody themselves. `access/delegation.ts` `grantCeiling`: Owners unlimited; Admins only where their own role is Creator (base) or Creator/Owner (workspace), up to that rank; `roleRank` puts `none`/removal at 0.
* **Members & access (`members/routes.ts`):** `managerOrg` (Owner/Admin) replaces the Owner-only guard; `ownerOrg` stays for account types and transfer. `GET …/access` returns `me`, per-member `isMe`/`canManage`, and for Admins only the workspaces/bases they manage (`manageable` per workspace), their grants and invitations. Grants: Admins checked against `grantCeiling` for both the new and the existing role; workspace grants accept `owner`. Suspend/remove/devices go through `targetMember`/`assertDeviceManageable`. New `PUT /v1/orgs/:orgId/members/:userId/role` (Owners; keeps one active Owner) and `POST /v1/orgs/:orgId/transfer-ownership` (target Owner, actor Admin). Tokens: Admins create, list and revoke only their own; Owners see all with `createdBy`; `resolveApiToken` accepts Owner or Admin creators (the token acts as its creator). `/v1/orgs` returns `canManage`.
* **Invitations:** Owners and Admins invite (`mayInvite`); Admins limited by `grantCeiling`; `orgRole` admin/owner only by Owners; `organizationId` without workspace/base for Admin/Owner invites (`resource_type 'org'`). Accept inserts the member with `org_role` and on conflict only raises it. Revoking Admin/Owner invitations: Owners. Public preview returns `orgRole` and `organizationName`.
* **Elsewhere:** Admins rename/delete any workspace (`assertWorkspaceOwner`); workspace list adds `orgRole`, `canManage` = Owner or Admin with Creator/Owner there; device approval notifications go to Owners, plus Admins for Members' devices; billing is Owner-only.
* **Web:** `InviteForm` is exported and used by Home Share (`MembersDialog`, starts on `wsp:<id>`); Owners get an Account type select (Member/Admin/Owner, "No workspace or base yet" for Admin/Owner) and "Workspace Owner" on workspace scopes. Member cards: Admin/You badges, account type select and Transfer ownership for Owners, actions only when `canManage`, access rows disabled where an Admin may not manage the workspace. Devices: decide buttons only where allowed. Accept page shows "You'll join as Admin/Owner". Help → Members, roles & privileges, Device approval and API tokens describe the three account types.
* **Live (read-only, `.data/r17-live-roles-report.mjs`):** nobody holds Billing admin, Guest or Admin, so the migration changes no live rows; the planned Owners (ai.deptbcc@bluecascade.org, ai.departmentbluecascade@gmail.com) and Admin (awais.ahmed@bluecascade.org) have no accounts yet.
* Tests: `.data/verify-r17-phase2.mjs` (47 checks), `.data/r17-seed.mjs` + `.data/r2-shell/r17-ui.mjs` (24 checks, screenshots `r17-*.png`).

## v0.14.0: roles phase 1 (sign-up, workspaces, bases, duplicate, export, contacts)

Implements phase 1 of `docs/roles-and-permissions/Roles-Decisions-Questionnaire.md` (G1–G4, G9; B1, B4, B6, B7). Roles history: `docs/roles-and-permissions/ROLES-CHANGELOG.md`.

* **Sign-up** (`auth/signup-policy.ts`, `auth/routes.ts`): `decideSignup` returns `create_org` (signup mode `open`, or no active organization yet), `invited` (a pending, unexpired invitation for the email), `domain` (an active org whose `settings.signup.allowedDomains` holds the email's domain) or `denied` (403, "by invitation only"). Only `create_org` creates an organization (now kind `standard`), Home workspace and subscription. `domain` inserts an `organization_members` row (`member`, source `domain_auto_join`) and notifies the org's Owners/Admins. The response carries `joinedVia`; `organization`/`workspace` are null when none was created.
* **Platform setting** (migration `0081_platform_settings.sql`): `core.platform_settings(key, value jsonb)`, `signup_mode = "restricted"`. The local `tabula_cc` test database is set to `"open"` so the older suites can still sign up owners; `verify-r16-phase1.mjs` switches it while it runs.
* **Allowed domains:** `PATCH /v1/orgs/:orgId/settings` takes `requireDeviceApproval` and/or `allowedSignupDomains` (lower-cased, leading `@` dropped, validated, max 50) and returns both; `GET …/access` returns `org.allowedSignupDomains`. Security tab (`AdminPage.tsx` `SettingsSection`) shows chips with remove and an Add domain field.
* **Owner/Admin-only** (`isOrgManager` / `isOrgManagerRole` in `access/workspace-access.ts`): `POST /v1/workspaces` (422 with `meta.organizations` when the person runs several orgs and sends no `organizationId`), `POST /v1/workspaces/:w/bases`, `POST /v1/bases/:b/duplicate` (target workspace must be in the same org), `GET …/tables/:t/export` and legacy `POST …/export/csv`.
* **Contacts** (`contacts/routes.ts`): `directoryScope` uses `getWorkspaceAccess(...).workspaceRole`; base-only people get 404.
* **Listings:** `GET /v1/workspaces` returns `organizationId`, `organizationName`, `canManage`, `workspaceRole` (null = base roles only) and skips non-active orgs; `GET /v1/bases/:b` returns `canManageOrg`; `/v1/orgs` and `primaryOrgId` skip non-active orgs.
* **Web:** Home hides + Create workspace / Create a base / Duplicate for non-managers. New `CreateWorkspaceDialog` with an Organization picker. Workspace menu shows Rename only to workspace owners and Contacts only with a workspace role. Empty Home for people without access explains who grants it. The base menu hides Duplicate base; Tools and the table tab menu hide Export CSV (`onExport` optional). The sign-up subtitle says accounts are by invitation.
* **Live clean-up (B6), not run yet:** `.data/r16-live-cleanup-report.mjs` (read-only report; JSON in `.data/r16-live-cleanup-report.json`) and `.data/r16-remove-personal-orgs.mjs` (dry run by default; `--apply` soft-deletes every org except "Arslan's workspace" and trashes their workspaces and bases in one transaction, writing a backup; `--revert FILE` restores). Live on 2026-10-19 has 13 organizations to remove (25 workspaces, 3 small bases) and no bases copied across organizations.
* Tests: `.data/verify-r16-phase1.mjs` (34 checks), `.data/r16-seed.mjs` + `.data/r2-shell/r16-ui.mjs` (16 checks, screenshots `r16-*.png`). The `pw.mjs` login helper now fills `input#password` (the Show password button also matched `/password/i`).

## v0.13.0: show password, CORS max-age

* `packages/ui/src/PasswordInput.tsx`: an input with an eye button (`aria-label` "Show password"/"Hide password", `type="button"` so Enter still submits). Used in `routes/login.tsx`, `routes/signup.tsx` and `AccountPage` (keeps its own `className`). `@tabula/ui` must be built (`--filter @tabula/ui build`) for the web typecheck; Vite reads its source.
* `apps/server/src/http/app.ts`: `@fastify/cors` gets `maxAge: 7200`, so preflights return `Access-Control-Max-Age: 7200`.
* Test: `.data/r2-shell/r14-ui.mjs`.

## v0.12.1: fast syncs with invalid values

* After the 0.12.0 deploy, the live Airtable syncs (about 4,400 records each) crawled: batches full of invalid phone numbers fell back to one transaction per record. `syncOnce` now runs each new or changed value through `getFieldType(type).normalize` (typecast, stub `createOption`) while reading. A `FieldValidationError` becomes an issue and a null value up front, so batches don't fail. The record-by-record fallback stays for anything else. Measured locally: 2,000 records, all with invalid phones, in 4.1 s (`.data/r13-perf.mjs`).

## v0.12.0: sync issues and control, import stop and invalid entries, devices log, grouped history

* **Why syncs failed:** record writes use `typecast`, so one invalid value (Airtable phone "call me maybe") threw `FIELD_VALIDATION_FAILED` and failed the batch and the run (`status = 'error'`). Now `writeChunks` retries a failed batch record by record (`writeOneByOne`), nulls the rejected field (`ApiError.meta.field`), and stores it in `data.table_sync_issues` (0080). Each run replaces the issues of the records it rewrote. The content hash is the intended one, so unchanged records aren't retried every run.
* **Keep as text:** `table_syncs.field_overrides[sourceFieldKey] = "text"` maps that source field to text (the schema step converts the destination field) and sends values through `wireText`. Resolving resets the hashes of the affected records and starts a run.
* **Runs:** `startTableSync` (Sync now / Resume / resolve) runs in the background; `POST …/sync/run {wait:true}` keeps the old blocking behaviour (used by `verify-sync`). `checkpoint()` (at most every second, per source batch and write chunk) writes `progress`, extends `locked_until` and throws `SyncCancelledError` when `cancel_requested`. Stop = `POST …/sync/stop`; Pause also requests a stop. A stopped run keeps its status and says "Stopped before it finished".
* **Scheduler in the API** (`entrypoints/api.ts`, `SYNC_IN_API`): production only runs the API, so syncs had never refreshed on their interval. The sweep claims each sync's lock first.
* **Record ID primary:** creating a synced copy of a table whose primary is "Record ID" added a second "Record ID" field (409). The local one is now "Local record ID".
* **Import:** row errors carry `field` (also stored in `data.import_errors.field_id`). The wizard keeps the failed rows (`FailedRow`) with an editable value: "Import with my corrections", "…left empty", "Skip", CSV. Stop aborts the in-flight request (`AbortController`) and shows the summary at once; chunks are 100 rows.
* **Devices log:** `GET /v1/orgs/:orgId/device-log` returns, per member, devices with `decidedBy`, the last 30 sessions (active = not revoked or expired; automation sessions excluded), and history from `org_devices.first_seen_at` plus `audit.audit_events` `device.*` (device.deleted now records `userId`).
* **History grouping:** `RecordActivity` `groupHistory()` groups by person or by field (one entry per field change; created/deleted get their own group), stored in `localStorage["tabula.recordActivityGroup"]`.
* **Process slip:** the live preview was still running from 0.11.0 while server code was edited, so its restart applied 0080 (additive) to the shared database before approval. No sync ran against live with the new code (checked).
* **Tests:** `.data/verify-r13.mjs`, `.data/r2-shell/r13-ui.mjs`.

## v0.11.0: access per base, notifications on Home, Help Back, import clashes

* **Access rule** (`packages/permissions/src/snapshot.ts` `combineBaseRole`): workspace `owner` → creator everywhere; otherwise a base grant wins over the workspace role (higher or lower), and base role `none` (`NO_ACCESS_ROLE`, allowed by migration 0079) means no access. Before, the higher of the two won, so a base could never be removed from a workspace member. `listBaseCollaborators` uses the same rule (and now skips expired grants); `GET /v1/workspaces` ignores `none` grants.
* **Why "one base gave the whole workspace":** on live, Mahad's `Home` editor grant came from two workspace invitations (home-page Share dialog). The later Signize.us invite was correctly base-only. With overrides the owner can now block single bases.
* **Multi-base invites:** `core.invitations.extra_base_ids uuid[]` (0079); `POST /v1/invitations` takes `baseIds` (same org, owner only); accept grants each base. The admin invite form has "Selected bases only" with a tick list.
* **Admin matrix:** row checkboxes and `BulkAccessBar`. "No access" on a base under a workspace role writes `none`, otherwise removes the grant. Base rows offer "No access to this base" plus Reset/Remove.
* **Bell:** `NotificationsBell` on Home (`routes/home.tsx`), polling every 15 s. Desktop alerts use `Notification` after "Turn on"; `localStorage["tableos:desktop-notified-at"]` holds the newest time seen, so the first load and old items never pop up, and `tag` dedupes across tabs.
* **Help Back:** topic navigation and the `/help` redirect use `replace: true`.
* **Import:** a column whose name matches a field in the destination table (`matchFor`) is a highlighted row (`data-testid="import-match"`) with radio choices: existing / new (name and type) / replace / skip / a different field. Replace sets `ColumnMap.replace`; `run()` deletes those fields (`fieldsApi.remove`, soft delete, Undo restores) before creating the new ones, and their names count as free. Into-existing is disabled for non-writable types, and replace is disabled for the primary field. `uniqueName()` suggests free names; `nameProblems` marks bad rows; "Rename them for me" fixes them all. A new table reserves "Record ID". Test: `.data/r2-shell/r12-import.mjs`.
* **Tests:** `.data/verify-r12.mjs` (per-base access and a 12-action privilege matrix for viewer/commenter/editor/creator), `.data/r2-shell/r12-ui.mjs`.

## v0.10.0: attachments, time zones, device alerts, last-modified backfill, filter values

* **Workflow rule:** `.cursor/rules/release-workflow.mdc` (always applied) lists the steps: understand, edit, test the change and the whole suite on `tabula_cc`, preview, version, push `release/vX.Y.Z`, merge only after approval.
* **Last modified time (watched fields):** stored in the cell, previously stamped only by edits after the field existed. `data.backfill_watched_modified_time(field_id)` (migration 0078) takes the newest `record.updated` op in `data.base_changes` where a watched slot changed (before = `prevCells` or the inverse op) or a watched link changed, else `created_at` when a watched value exists. `createFieldInTx` and `updateFieldInTx` (watch list or type change) call it; the migration ran it for existing fields.
* **Device approval bell:** `access/devices.ts` `notifyDeviceRequest` runs once, when a pending `core.org_devices` row is inserted (`RETURNING id`). It notifies the active org owners (category `system`, link `/admin?tab=devices`).
* **Time zones:** `FieldConfigEditor` `DateTimeConfig` (datetime, created_time, modified_time): toggle for one zone, grouped `<optgroup>` list plus `Intl.supportedValuesOf("timeZone")`, `showTimeZone`. `format.ts` `formatDateTime` uses the zone for every date format and appends `timeZoneAbbr` (en-US names, en-GB for Europe so CET/BST appear).
* **Downloads:** wire `downloadUrl` = signed `/v1/public/files/:token/:name?download=1` for every driver. For GCS, `sendAttachmentBody` redirects to a URL signed with `responseDisposition: attachment`. `AttachmentViewer.downloadHref(a)` prefers it.
* **Expand attachments:** `field-ui/AttachmentsDialog.tsx`; `GridView` shows `.cellExpandBtn` on the active attachment cell.
* **Filter values:** `.condValue > .tfu-form-box` fills the cell, and the form-mode `PickerShell` shows ▾.
* **Tests:** `.data/verify-r11.mjs` (API), `.data/r2-shell/r11-ui.mjs` and `r11-filter-slow.mjs` (browser; the latter delays view saves by 1.5 s like the live server). `verify-r10.mjs` now waits for automation F before editing Bob.

## v0.9.1: automations run again

* **Why they stopped:** production (Render) runs only `node dist/api.js`, and `startAutomationEngine` was only called from `entrypoints/worker.ts` (which also needs Redis). Test runs worked because `/test` executes inline in the API; real triggers sat in `data.outbox_events` with nobody advancing `automation_engine_state.outbox_cursor`.
* **Fix:** `entrypoints/api.ts` starts the engine after `listen`, with `API_URL` pointed at itself. The consumer holds advisory lock 728431901 and runs are claimed with `FOR UPDATE SKIP LOCKED`, so an API and a worker together never double-run (verified: one run per record with both up). `AUTOMATIONS_IN_API=false` turns it off. Catch-up is capped at one hour (`MAX_CATCH_UP_MS` in `consumer.ts`), so the first start on the live database didn't replay the backlog since 13 Oct.
* **Still worker/relay only:** table sync, search indexing and comment notifications need `relay.ts` + `worker.ts` with Redis. Production doesn't run them yet.
* **Scripts:** `script.ts` PRELUDE has an Airtable-compatible `base` (`getTable`, `selectRecordsAsync`, `*RecordAsync(s)`, `record.name`, `getCellValue(AsString)`); `config.inputs` (name + token value) feed `input.config()`, which always has `recordId`. `TableMeta.primaryFieldId` added for `record.name`.
* **UI state:** `features/automations/remembered-state.ts` (`sessionStorage`, key `tableos:aut:…`) holds the selected automation, Edit/Run history tab, step and expanded run. `base.tsx` clears the one-shot `automationTarget` (Gmail return) when you leave Automations.
* **Conditions:** `views.module.css` makes `.filterGroup`/`.filterGroupNested` inline-size containers; at ≤560px a condition is field+operator over value, at ≤340px field, operator and value each take a line.
* **Tests:** `.data/verify-r10.mjs` (local `tabula_cc` only): every trigger except forms, update/create/condition/script actions, loop guard, turning off. UI: `.data/r2-shell/r10-ui.mjs`.

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
