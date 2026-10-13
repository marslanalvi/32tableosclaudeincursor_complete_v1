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
- Feature work happens on branches (for example `Awais-Improvements`) and is merged into
  `master` once typecheck and the verify scripts pass.
- Hotfixes branch from the release tag, bump PATCH, and are merged back to `master`.

## Release history

Tags `v0.1.0`–`v0.7.0` were added to existing commits when versioning was introduced; see
`CHANGELOG.md` for what each one contains. Since then each release is tagged when it is cut
(`v0.8.0`: record activity, one-row filters, views sidebar, sessions without expiry).
