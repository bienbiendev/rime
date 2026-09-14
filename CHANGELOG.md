# rimecms

## 0.32.0

### Minor Changes

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: auto-save on `versions: { draft: true, autoSave: true }`. An editor's typing lands in a row of their own after a short pause, is offered back by a banner when newer than the row on screen, can be opened and finished by anyone, and becomes a version on save with the status of the row it branched from.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Changed: `latest` and `versionId` on the public read endpoints are honoured for staff only; anyone else gets the published version. The versions collection (`/api/<slug>--versions`) is readable by staff only.

- [`19a6726`](https://github.com/bienbiendev/rime/commit/19a67264053cef99105e9a775cff0089b0126e37) - Breaking Change: Drizzle ORM and Kit move to 1.0.0-rc.4.

  **Your `db/` folder needs converting.** Drizzle 1.0 restructured it — `meta/_journal.json` is
  gone and each migration's snapshot now sits beside its SQL. Rime detects the old shape and runs
  `drizzle-kit up` for you on the next generate, but it rewrites files git is tracking, so commit
  before upgrading.

  The migrator also changed how it decides what to apply: every missing migration runs, matched by
  full folder name rather than by timestamp order. A linear history is unaffected; one that has
  merged branches may not be.

  Both packages are pinned to the exact release, and `rime init` installs that same version — an app
  on a different rc than the rimecms it installed is a split that fails at runtime, not at install.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: `duplicate` takes a `versionId` (`POST /api/<slug>/<id>/duplicate?versionId=`) and copies that row, auto-saved or not; the panel duplicates the row on screen.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Changed: the edit lock is held on the version being edited, named by `?versionId=` on the lock endpoints, and moves with the row an auto-save or a fork makes.

- [`19a6726`](https://github.com/bienbiendev/rime/commit/19a67264053cef99105e9a775cff0089b0126e37) - Breaking Change: `$rime/modules` should now include full path from lib to module(.server).ts, ex: `$rime/modules:path/from/lib/to/module`. This is to avoid ambiguity.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Changed: the version history is a drawer on the document page, opened from the settings menu, instead of a route. The panel no longer remounts on every URL change; the listing and the document are keyed on what identifies them. "Delete this version" and "Delete the document" are two menu items.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: a read fills an untranslated localized field from the other locales, field by field, requested locale first, then the default, then the rest in config order; filters and sorts on a localized field see the same value. Localized blocks, tree and relation fields do not fall back. `localization.fallback: false` reads one locale only; `localeFallback: false` does it for one read. A new version keeps the translations its original has.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Breaking Change: a create writes one locale; the created locale's values are no longer copied into the others. The `isFallbackLocale` context flag and its validation, hook and access exceptions are gone; `isLocaleCopy` marks the per-locale copy behind `duplicate` and new versions.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: `$references(slug, { resolve: true })` on a text field resolves the referenced document on read; `createdBy`, `updatedBy` and `currentlyEditedBy` read as `{ id, name, email }`. `$root()` on a relation is refused by config validation.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Breaking Change: `draft` is a status, nothing else. `latest` selects the newest version on a read and on a write (`GET ?latest=true`, `PATCH ?latest=true`, `latest: true` on the Rime API) where `?draft=true` used to; `fork` makes a new version from the selected row (`PATCH ?fork=true`, `fork: true`) where `PATCH ?draft=true` used to. An update starts from the row a read would return, so an update on a document with no published version answers `404` unless it says `latest=true`. A config with versions and no drafts keeps a version per save.

### Patch Changes

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: a singleton's bootstrap no longer writes an empty locales row; a `null` element in a relation list is skipped instead of answering 500; a locales branch fetched under `select` carries its locale; an empty string in a required localized column counts as unwritten; `updatedAt` comes from the version row like `updatedBy`.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: a `RimeError` out of a panel action is shown in the form, and a redirect answer is applied, so an area's "save in a new draft" lands on it; switching locale with unsaved changes flushes the auto-save or asks first; a create form no longer turns into an update when a field writes `id`, which broke creating an upload directory; a self-disabling menu item no longer keeps the menu open.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: an upload collection with image sizes keeps its blocks, tabs, groups, tree and relation fields in the generated document type.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: publishing through a fork or a named version demotes the previous published version; `maxVersions` prunes a config without drafts; a promoted auto-save keeps the status it inherited; a status change refreshes the version history; `findById` and the area `find` no longer drop the read intent, so an update starts from the published row as documented.

## 0.31.5

### Patch Changes

- [`bf0c0d8`](https://github.com/bienbiendev/rime/commit/bf0c0d8d6d8bf185bf49835aa4ce3815cadea1cd) - Added: configurable `/panel` path over env var `RIME_PANEL_ROUTE`

- [`3ba9562`](https://github.com/bienbiendev/rime/commit/3ba9562d654fdf458754853d2ba50b07f2935ff2) - Fixed: an issue where `hooks.server.ts` was fully reseted after a `RIME_CONFIG_DIR` change and a regeneration.

- Breaking Change: `/panel` path is now configurable, meaning you may run `rime generate --force` after updating to regenerate `/(rime)` routes

## 0.31.4

### Patch Changes

- [`684a43e`](https://github.com/bienbiendev/rime/commit/684a43e229e618a073cf700b48b0b94f92b150af) - Added: Custom config directory under `RIME_CONFIG_DIR` env var

- [`684a43e`](https://github.com/bienbiendev/rime/commit/684a43e229e618a073cf700b48b0b94f92b150af) - Breaking Change: Default config directory path is now `src/+rime`, you may add `RIME_CONFIG_DIR=src/lib/+rime` to .env, if yours differs.

- [`b14a276`](https://github.com/bienbiendev/rime/commit/b14a27687bf14ffa353aca73e852164cdbad90c3) - Upgrade `better-auth` from `1.4.21` to `1.7.1`.

  The `apiKey` plugin now ships as the separate `@better-auth/api-key` package. The generated `auth_accounts` table gains a required `issuer` column and renames `account_id` to `provider_account_id`; the generated `apikey` table renames `user_id` to `reference_id` and adds `config_id`.

  There is no automated data migration. Upgrading requires dropping and recreating the `auth_accounts` and `apikey` tables (or resetting the dev database) and re-creating users.

## 0.31.3

### Patch Changes

- Fixed: custom collection CustomHeaderComponent fails to retrieve the collection context

- Fixed: make argument optionnal for local api collection methods `delete` and `find`

## 0.31.2

### Patch Changes

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop collection context `addDoc|updateDoc|deleteDoc``methods

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop getCollectionContext KEY argument

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Added: Expose `CONTEXT.<NAME>` under `rimecms/panel` to allow simpler context retrieval ex: `getContext(CONTEXT.COLLECTION)` from consumer libs.

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop getAPIProxyContext KEY argument

## 0.31.1

### Patch Changes

- Fixed: `module.(server.)ts` pairs not resolve at root src/lib
- Fixed: `$rime/modules` types not generated on `rime generate` command
