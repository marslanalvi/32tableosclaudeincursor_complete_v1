# Versioning and releases

TableOS uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Part  | Goes up when                                                                 | Example        |
|-------|-------------------------------------------------------------------------------|----------------|
| MAJOR | A breaking change to the public API (`/v1`), data migrations that can't be rolled back, or removed features | 0.x → 1.0.0 |
| MINOR | New features or behaviour changes that stay compatible                         | 0.6.0 → 0.7.0  |
| PATCH | Bug fixes only                                                                 | 0.7.0 → 0.7.1  |

While the version is `0.x`, minor releases may still include small breaking changes; they are
called out under **Changed** in the changelog.

## One version for the whole product

The root `package.json` and every app (`apps/server`, `apps/web`, `apps/public`) carry the same
version. Internal packages under `packages/` are not versioned separately.

Where the version shows up:

| Place | Source |
|-------|--------|
| `GET /v1/version` → `{ name, version, commit, startedAt }` (no auth) | `apps/server/src/lib/version.ts` |
| `GET /health` → `{ ok, version }` | same |
| `x-tableos-version` header on every API response | same |
| Help page sidebar, **Help → Release notes**, account menu "What's new" | `apps/web/src/lib/version.ts`, injected by `apps/web/vite.config.ts` |

The commit is taken from the `GIT_COMMIT` environment variable if set (use this in CI/Docker,
where `.git` may be missing), otherwise from `git rev-parse --short HEAD`.

## Cutting a release

1. Make sure `master` is green: typecheck all apps and run the verify scripts.
2. Bump the version everywhere:
   ```sh
   node scripts/version.mjs minor      # or: patch | major | 0.8.0
   # same as: pnpm version:set minor
   ```
   Running `node scripts/version.mjs` with no argument prints the current version.
3. Move the **[Unreleased]** notes in `CHANGELOG.md` under a new heading
   `## [x.y.z] - YYYY-MM-DD`, using the Added / Changed / Fixed / Removed / Security sections,
   and add the compare link at the bottom.
4. Add the same release, in plain language for users, to the top of
   `apps/web/src/features/help/releases.ts`.
5. Commit and tag (annotated tags):
   ```sh
   git commit -am "Release vX.Y.Z"
   git tag -a vX.Y.Z -m "TableOS X.Y.Z"
   git push complete master --follow-tags
   ```
6. Deploy with `GIT_COMMIT=$(git rev-parse --short HEAD)` set, then check
   `curl https://<host>/v1/version`.

## Branches

- `master` is always releasable; tags are cut from it.
- Every release is prepared on its own branch, `release/vX.Y.Z`, and pushed there for review.
  Typecheck and the verify scripts must pass first.
- **Nothing is merged into `master` without the owner's explicit approval** after previewing the
  release branch. The version tag is created on `master` only after that merge.
- Hotfixes follow the same path: branch, bump PATCH, preview, approval, then merge.
- Database migrations are applied automatically when the API starts (`MIGRATE_ON_START`).

## Release history

Tags `v0.1.0`–`v0.7.0` were added to existing commits when versioning was introduced; see
`CHANGELOG.md` for what each one contains. Since then each release is tagged when it is cut
(`v0.8.0`: record activity, one-row filters, views sidebar, sessions without expiry;
`v0.8.1`: reverts 0.8.0 except sessions without expiry;
`v0.8.2`: production sign-in fix, migrations applied on API start;
`v0.9.0`: field permissions, search by column name, no logout while searching, activity and filter menus;
`v0.9.1`: automation engine runs inside the API, remembered automation tab/step, narrow conditions layout, Airtable-style scripts;
`v0.10.0`: expandable attachment cells, working downloads, device-approval notifications, field time zones, last-modified backfill, editable filter values;
`v0.11.0`: per-base access overrides and multi-base invites, bulk access changes, bell on Home with desktop notifications, Help Back, import name clashes;
`v0.12.0`: syncs skip invalid values (review / keep as text), background Sync now with Stop/Pause/Resume, sync scheduler in the API, instant import Stop and fixable invalid entries, devices log per person, grouped record history;
`v0.12.1`: sync values pre-checked against their field so invalid ones don't force slow per-record retries;
`v0.13.0`: show/hide password, CORS preflight max-age 7200;
`v0.14.0`: roles phase 1 — sign-up by invitation or allowed domain, no personal organizations, Owner/Admin-only workspaces, bases, duplicate and export, contacts need a workspace role;
`v0.15.0`: roles phase 2 — Owner/Admin/Member only, several Owners and transfer, Admins manage Members within what they're given, invitations with an account type, workspace Owner role, one invite form;
`v0.16.0`: roles phase 3 — two-factor required for everyone, 30-day idle sessions, share links for Creators with "allow copy" enforced, Owners/Creators always edit fields, automation "Runs as", hidden notifications for closed bases, move base to another workspace, member emails for managers only, Activity log;
`v0.16.1`: realtime served by the API (live changes in production), protected default Grid view, delete workspace from Home;
`v0.16.2`: short BullMQ job history (Redis OOM), realtime tickets fall back to memory;
`v0.16.3`: fix phase 1 of the test round — Esc cancels long-text edits, multi-line JSON paste stays in one cell and invalid JSON is refused, real version in production builds, `GET /v1/tables/{tableId}` and `GET …/records`, API tolerant of `//`, trailing slashes and bare tokens with clearer errors, "Via API" in record history;
`v0.16.4`: sample request/response JSON for every endpoint and for errors in Help → API reference;
`v0.16.5`: API-token responses keyed by field name with option names (`returnFieldsByFieldId=true` for IDs)).
