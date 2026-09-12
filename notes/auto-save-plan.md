# Auto-save on versioned documents

Plan for the open TODO line `Handle auto-save if version enabled`, against what is on disk today.

Decision it implements: an auto-save writes a version row flagged `isAutoSave`. A save the
user asks for promotes the row it lands on and deletes every other auto-saved row of the
document. The REST API neither produces nor is changed by auto-saved rows.

---

## 1. Tour: what is on disk

### 1.1 Repo shape

| Area                         | Where                                          | What                                                                     |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Config, prototypes, pipeline | `src/lib/core/`                                | isomorphic core; `*.server.ts` is the server half                        |
| Versions feature             | `src/lib/core/prototype/shared/versions/`      | config, naming, strategy, hooks, read/write plans                        |
| Adapter                      | `src/lib/adapter-sqlite/`                      | drizzle; reads/writes a _base_ row plus a _content_ row                  |
| Panel                        | `src/lib/panel/`                               | Svelte 5; `context/documentForm.svelte.ts` is the form state             |
| Fixtures                     | `tests/<name>/lib/+rime/rime.config.server.ts` | `bun run rime:use <name>` copies one to `src/lib/+rime`                  |
| e2e                          | `tests/<name>/api.test.ts`                     | Playwright `request` fixture against `vite dev`; `bun run test:versions` |
| Unit                         | `*.spec.ts` beside the code                    | vitest                                                                   |

`node_modules` is absent in a fresh clone: `bun install` first.

### 1.2 Versions, as stored

- A versioned config gets a derived collection `$<slug>__versions` (`configure.server.ts`),
  whose fields are the base config's non-`._root()` fields. Its slug is stamped on the base
  config as `_versions.slug` (`augment.ts`), which is how the adapter and the pipeline find it.
- The schema generator (`adapter-sqlite/generate-schema/index.server.ts:52-89`) builds two
  tables from that: the base table keeps `createdAt`, `updatedAt`, `createdBy` and any root field;
  the versions table gets everything else plus `ownerId → base.id` (cascade delete). Blocks,
  tree and relations hang off the versions table.
- `augmentVersions` normalises `versions` to `{ draft, autoSave, maxVersions }` and, when
  `draft` is on, pushes `text('status').defaultValue('draft').hidden()` onto the fields. That is
  the precedent for adding a column to every versions table from the feature: **push a hidden
  field in the augment**.
- `autoSave` is normalised there (`augment.ts:36`) and read nowhere else (`grep -rn autoSave src`).
  Setting it today changes nothing.
- `hidden()` only affects the panel. A hidden field is writable through any request body:
  `ButtonStatus.svelte` publishes with `PATCH { status }`, and the e2e suite does the same. So a
  flag the server must own has to be stripped from incoming data, not merely hidden.

### 1.3 Versions, as read

`read-query.ts` decides which content row a read means:

```
versionId given          that row, whatever its status
no drafts in config      no narrowing → the adapter takes the newest row (updatedAt desc)
intent 'original'        published
a read                   published, unless draft=true → newest row
```

Public API reads on a draft-enabled config therefore never see anything but the published row.
Panel loads read `draft: true` (`collection-document/load.server.ts:63`, `area/load.server.ts:43`)
and so see the newest row. `versionId` is exposed on every versioned document by
`exposeVersionId` from the adapter's `contentId`.

### 1.4 Versions, as written

`runUpdate` (`pipeline/run.server.ts:255`) runs the `beforeUpdate` list, builds a write plan,
writes, persists blocks/tree/relations against `context.contentOwnerId`, rereads, runs
`afterUpdate`. The list is hand-written in `collection/hooks.server.ts:95-117` and
`area/hooks.server.ts:45-56`; a hook not placed there never runs and nothing warns (the
`hook-placement.spec.ts` the comments cite does not exist).

Versions hooks, in order:

1. `getOriginalDocument` (core) reads the original with `intent: 'original'` and the request's
   `versionId`/`draft` → `context.originalDoc`. With a `versionId` that is the named row.
2. `defineVersionOperation` → `context.versionOperation`, from `strategy.ts`:

   ```
   no versions                                UPDATE
   versionId                                  UPDATE_VERSION
   no draft in config                         NEW_VERSION_FROM_LATEST
   draft=true                                 NEW_DRAFT_FROM_PUBLISHED
   otherwise                                  UPDATE_PUBLISHED
   ```

3. `handleNewVersion` (`beforeUpsert`): a specific-version op sets `contentOwnerId` to the
   original's `versionId`; a new-version op builds the row from the submission _as sent_ with
   unsent fields filled from `originalDoc` (`fallbackDataFromOriginal`), forces `status: draft`
   unless sent, strips child ids so blocks/relations are re-created, inserts through
   `rime.collection('$x__versions').create()`, then prunes `status != published` rows beyond
   `maxVersions` by `-updatedAt`.
4. `stampUpdatedBy`, `buildDataConfigMap` (its keys are the only paths the write may touch),
   `setDefaultValues`, `validateFields`.
5. `demoteOtherVersions` (`beforeUpdate`, last): only on a specific-version op whose data carries
   `status: published`; sets every other version of the document to draft through
   `adapter.contentOwner(slug).updateWhere` — which moves no `updatedAt`.

`versionsWritePlan` then splits root vs content data and names the content row, or names none
when `handleNewVersion` already inserted it.

### 1.5 The REST and panel entry points

- REST `PATCH /api/<slug>/<id>?draft=&versionId=` → `restUpdateById` → `collection.updateById`.
  No other version parameter exists. Area: `area/rest/update.server.ts`.
- Panel form action `?/update` (`collection-document/actions.server.ts:66`,
  `area/actions.server.ts:11`) reads the same two params, calls the same local API, and when
  `draft` was set answers with a redirect to `/versions?versionId=<new>` (the area returns a 303).
- `documentForm.svelte.ts`:
  - `changes = diff(initialDoc, doc)`; `canSubmit` needs changes, no errors, not disabled.
  - `prepareData` sends **only the changed top-level keys**, flattened into FormData.
  - `enhance` reads the submit button: `data-status` sets `status` on the doc; `data-draft`
    appends `&draft=true`, else `&versionId=<doc.versionId>` (the panel always has one).
  - `submit()` guards on a single `processing` flag, POSTs, and on success **replaces `doc` and
    `initialDoc` with the server document** — keystrokes typed during the round trip are lost.
- `Header.svelte:71-118` is four save scenarios by config; `Settings.svelte:29-43` builds "save in
  a new draft" by flipping the save button's dataset and re-submitting.
- `Document.svelte`: `beforeNavigate` cancels and opens a confirm dialog when `changes` is
  non-empty; ctrl/cmd-s submits the `[data-submit]` button; the edit lock is claimed on mount and
  renewed at half `EDIT_LOCK_TTL_MS` through `POST /api/<slug>/<id>/lock`, which writes the two
  lock columns on the **newest** row via `updateWhere` (no pipeline, no `updatedAt`, no version).
  A lock change fans out over SSE (`rime:<slug>:<id>` → `invalidateAll`).
- The page keys the form on `doc.id + doc.versionId + locale`; only load data remounts it.
- `Versions.svelte` lists rows from
  `GET /api/<slug>--versions?where[ownerId][equals]=<id>&sort=-updatedAt&select=updatedAt,status`.
- `duplicate.ts:92` reads its source with `draft: true`, i.e. the newest row.

---

## 2. Design

### 2.1 Semantics

- `versions: { draft: true, autoSave: true }` opts a config in. `autoSave` without `draft` is a
  config error: with `versions: true` every save is the live content, and auto-saving it would
  publish half-typed edits.
- Every versions table of an opted-in config carries `isAutoSave: boolean` (default `false`).
- An auto-save is an update the **panel** sends with `autoSave=true`, always naming the row on
  screen with `versionId`:
  - the named row is a real version → insert a new row from it: its content, the submission on
    top, `status: draft`, `isAutoSave: true`. The panel then edits that row.
  - the named row is already `isAutoSave` → update it in place. One editing session is one row.
- A manual save (anything without `autoSave=true`, panel or API):
  - writes exactly as today; if it lands on an `isAutoSave` row (`UPDATE_VERSION`) that row
    becomes a normal version (`isAutoSave: false`);
  - afterwards deletes every other `isAutoSave` row of the document.
- `isAutoSave` in a request body is ignored, on create and on update. The server sets it from
  the operation, never from data.
- Auto-saved rows always stay `status: draft`, whatever the body says, so `demoteOtherVersions`
  never fires for them and the published row never moves.
- `maxVersions` counts real versions only; auto-saved rows are neither counted nor pruned by it.
- Reads are unchanged. Public reads on a draft config still see the published row only. A
  `draft: true` read sees the newest row, which after a crash is the auto-saved one — that is the
  recovery path, and the panel says so on screen.

### 2.2 Why the REST API cannot interfere

- `restUpdateById` and the area handler do not parse `autoSave`. The only way to produce an
  `isAutoSave` row is the local API argument the panel actions pass.
- `isAutoSave` is stripped from every body before the config map is built.
- Every other operation — `NEW_DRAFT_FROM_PUBLISHED`, `UPDATE_PUBLISHED`,
  `NEW_VERSION_FROM_LATEST`, `UPDATE_VERSION` — keeps its original row selection; the only
  addition is the post-write cleanup, which touches rows nobody but the panel created.

---

## 3. Work, in commit order

### C1 — reject `autoSave` without `draft`

- `core/config/validate.server.ts`: new `validateVersions(config)` beside `validateSlugs`,
  error message names the slug. Areas and collections.
- Spec next to the existing validate specs.
- Ten lines; lands alone.

### C2 — the column

- `versions/augment.ts`: when `normalizedVersions.autoSave`, push
  `toggle('isAutoSave').defaultValue(false).hidden()` after `status`. The generator then puts it
  on the versions table for free (§1.2).
- `versions/doc-type.ts`: add `isAutoSave?: boolean` to the contributed members when the config
  opts in (the contribution takes the config; today it takes nothing — extend the signature or
  contribute unconditionally as optional).
- New hook `versions/hooks/strip-auto-save-flag.ts` (`beforeUpsert`): `delete data.isAutoSave`.
  Placed as the first `when(isVersioned, …)` entry of **both** `beforeCreate` and `beforeUpdate`
  lists, collection and area (area has no create; update only).
- `configure.spec.ts` / a new `augment.spec.ts`: column present iff `autoSave`.
- Fixture: `tests/versions/lib/+rime/rime.config.server.ts` — `news` and `pdf` become
  `{ draft: true, autoSave: true }` (`pdf` keeps `maxVersions: 3`). Existing tests are unaffected:
  nothing in the REST suite can create an auto-saved row.
- Consumers who opt in run `rime generate` and get a drizzle migration adding the column.

### C3 — the server operation

- `strategy.ts`:
  - `Args` gains `autoSave?: boolean` and `originalIsAutoSave?: boolean`.
  - New constant `VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION`.
  - Order of decisions: no versions → `UPDATE`; `autoSave && versionId` →
    `originalIsAutoSave ? UPDATE_VERSION : NEW_AUTO_SAVE_FROM_VERSION`; `autoSave` without a
    `versionId` → `OPERATION_ERROR` (the panel always has one; nothing else may auto-save); then
    the four existing branches unchanged.
  - `isNewVersionCreation` includes the new op; `shouldRetrieveDraft` is untouched (a `versionId`
    read is the row itself).
  - `strategy.spec.ts` (new): a table of inputs → op, including the two auto-save rows and the
    guard.
- `define-version-operation.server.ts`: pass `autoSave: context.params.autoSave` and
  `originalIsAutoSave: !!context.originalDoc?.isAutoSave`.
- `handle-new-version.server.ts`:
  - `prepareDataForNewVersion` gains `autoSave`: forces `status: draft` and `isAutoSave: true`
    for the new op; sets `isAutoSave: false` otherwise (so a real new draft never inherits the
    flag through `fallbackDataFromOriginal`).
  - Specific-version branch: when `params.autoSave`, set `data.status = draft` and
    `data.isAutoSave = true` on the submission; when not, set `data.isAutoSave = false` — this is
    the promotion. Both before the return, so `buildDataConfigMap` sees the key.
  - Pruning: add `&where[isAutoSave][not_equals]=true` to the `maxVersions` delete query, and
    skip the prune entirely for the auto-save op. Check `buildCondition` ANDs sibling keys; if it
    does not, use the explicit `where[and]` form.
- New hook `versions/hooks/prune-auto-saves.server.ts` (`afterUpdate`): when
  `config.versions?.autoSave && !context.params.autoSave`, run
  `rime.collection(withVersionsSuffix(config.slug)).system().delete({ query: ownerId = doc.id AND
isAutoSave = true AND id != context.contentOwnerId })`. `system()` because the deletion is
  bookkeeping, not a permission the editor holds. `afterUpdate` because the save must have
  landed first. New `afterUpdate` timing entries in both hook lists.
- `types.ts` (`OperationContext.params`): `autoSave?: boolean`.
- `collection/operations/update-by-id.ts` and `area/operations/update.ts`: `autoSave?: boolean`
  in args, copied into `context.params`.
- `api.server.ts` (collection and area): forward the arg; the cache key for `findById` is
  unaffected (writes are not cached).
- Barrel `hooks/index.server.ts` exports the two new hooks.
- e2e, `tests/versions/api.test.ts`, driving the panel form action over HTTP with the same
  cookie the suite already logs in with (`POST /panel/news/<id>?/update&autoSave=true&versionId=…`
  with form-encoded fields), since that is the only door:
  1. first auto-save on a published `news` → a new row, `isAutoSave: true`, `status: draft`;
     `GET /api/news/<id>` still returns the old title.
  2. second auto-save naming that row → same row count, row updated in place.
  3. auto-save with `status: published` in the body → row stays draft.
  4. manual `PATCH /api/news/<id>?versionId=<autoRow>` with `status: published` → row has
     `isAutoSave: false`, is published, and no other `isAutoSave` row remains for the document.
  5. manual `?draft=true` save (panel action, no `autoSave`) → new draft, all auto-saved rows gone.
  6. `PATCH` with `isAutoSave: true` in the body → written row reads `false`.
  7. `pdf`: N auto-saves then `maxVersions` — real drafts beyond three are pruned, the
     auto-saved row survives until the next manual save.
  8. an auto-save without `versionId` answers an error, never a row.

### C4 — panel actions

- `core/constants.ts`: `PARAMS.AUTO_SAVE = 'autoSave'`.
- `collection-document/actions.server.ts` and `area/actions.server.ts`: read it, pass it to the
  update, and when set return `{ document }` only — no message, no redirect, no 303 — so the form
  can absorb it silently.

### C5 — the form

`documentForm.svelte.ts`:

- `const isAutoSave = $derived(!!config.versions?.draft && !!config.versions?.autoSave &&
operation === 'update' && !readOnly)`. Never on create (no id, no row), never on a nested
  form (those are creates).
- Split `submit(action)` into `send(action, formData, { silent })` plus a one-slot queue: an
  auto-save in flight makes a manual submit _wait then run_, not drop. Keep `processing` for
  manual saves only; add `autoSaveState: 'idle' | 'saving' | 'saved' | 'error'` and
  `lastAutoSavedAt`.
- `$effect` on `changes`: when `isAutoSave && canSubmitAuto` (no errors, not disabled, has
  changes), debounce 1500 ms of quiet, then `send(buildPanelActionUrl() +
`&${AUTO_SAVE}=true&${VERSION_ID}=${doc.versionId}`, await prepareData(), { silent: true })`.
  Cancel the timer on manual submit and on destroy.
- Merge, do not clobber: snapshot `sent = snapshot(doc)` before sending; on success
  `initialDoc = serverDoc` and `doc = applyPaths(serverDoc, diff(sent, doc))` — the paths
  changed since the snapshot win, everything else (`versionId`, `updatedAt`, `isAutoSave`,
  child ids the server assigned) comes from the server. Only the auto-save path uses this; the
  manual path keeps today's replace.
- When the returned `versionId` differs from the one in the URL, `replaceState` the
  `?versionId=` param so a reload lands on the same row. No `invalidateAll`: it would remount
  through the page's `{#key}` and drop focus.
- On failure: state `error`, no per-field toasts, no retry until `changes` moves again.
- `canSubmit` gains `|| !!doc.isAutoSave`: after an auto-save `changes` is empty, and the user
  must still be able to press Save to promote the row. That submit sends an empty body, which
  the server turns into `{ status, updatedBy, isAutoSave: false }` — blocks and relations are
  outside `incomingPaths` and untouched.
- `prepareData` is unchanged; upload collections carry `file` on the first auto-save only
  (afterwards `initialDoc` no longer differs on it).

`Header.svelte`:

- An indicator next to the save button: `common.auto_saving` / `common.auto_saved` with
  `locale.dateFormat(lastAutoSavedAt, { withTime: true })` / `common.auto_save_failed`.
- When `form.values.isAutoSave`, a tag `common.auto_saved_draft` beside the title so the editor
  knows the row on screen is not a saved version yet.

`Document.svelte`:

- `beforeNavigate`: when `isAutoSave` and `changes` is non-empty, `await form.flushAutoSave()`
  and let the navigation through; the confirm dialog stays for every other config. On flush
  failure fall back to the dialog.
- `pagehide`: optional `sendBeacon` of the same FormData to the auto-save action URL; a beacon
  that does not arrive costs at most one debounce window.
- The edit lock needs nothing: it claims the newest row through the existing endpoint, which is
  the auto-saved row once one exists.

`Versions.svelte`, `panel/index.ts`, both `load.server.ts`:

- `select=updatedAt,status,isAutoSave`; `DocVersion` gains `isAutoSave?: boolean`; rows with it
  render dimmed with a `common.auto_saved` tag. They stay listed: the point of the row is that
  the editor can find it.

i18n `en`/`fr` `common`: `auto_saving`, `auto_saved`, `auto_saved_draft`, `auto_save_failed`,
`auto_saved_infos`.

### C6 — changeset and docs

- `.changeset/*.md`, `minor`: "Added: `versions.autoSave` opt-in on draft-enabled configs …
  run `rime generate` to add the `isAutoSave` column". Not breaking: configs that do not opt in
  get no column.
- `notes/TODO.md`: tick the line. The rime-doc repo gets a section under versions.

---

## 4. Edges to settle while implementing

- **`duplicate` reads the newest row** (`duplicate.ts:92`), which may be auto-saved. Either make
  it re-read the newest non-auto-saved row when `document.isAutoSave`, or accept that a copy of
  an unsaved draft is what the editor sees on screen. The first is a few lines in `duplicate.ts`.
- **Live edit** shares the form context (`isLiveEdit`). Auto-save would work there unchanged;
  decide whether the iframe's `onDataChange` traffic plus a network save every 1.5 s is wanted,
  or gate `isAutoSave` on `!isLiveEdit` for the first release.
- **Multi-locale**: an auto-save carries `locale` like any save; `fallbackDataFromOriginal` fills
  the other locale's row from the original as today. Nothing new, but the e2e suite
  `versions-multilang` should get one auto-save case.
- **`updatedAt` on the base row** moves on every auto-save (`updatePrototype` writes it). The
  collection list is sorted by it, so a document being typed in floats to the top. Acceptable,
  and the same as a manual save; note it.
- **Locked documents**: `form.isDisabled` already blocks `canSubmit`; the auto-save effect must
  read the same guard so a "take control" by someone else stops the timer.
- **Where builder**: confirm two sibling `where[...]` keys AND together before relying on it in
  the prune queries; the fallback is the explicit `where[and][0]…` form.

## 5. Decisions taken here, easy to reverse

| #   | Choice                                                             | Alternative                                          |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| D1  | One auto-saved row per (document, row on screen), updated in place | A row per debounce tick, relying on `maxVersions`    |
| D2  | `draft: true` reads surface the auto-saved row as newest           | Exclude `isAutoSave` from "newest" outside the panel |
| D3  | Auto-saved rows listed in the sidebar, dimmed                      | Hidden from the list                                 |
| D4  | 1500 ms quiet period, no retry on error until the next change      | Fixed interval, exponential retry                    |
| D5  | REST does not accept `autoSave`                                    | Parse it on `PATCH` too, same semantics              |

## 6. Cost

C1–C4 are server work with unit and API coverage: about a day. C5 is where the risk is — the
merge on response and the submit queue are the two things that decide whether the feature eats
text — about a day and a half with a browser-level check. C6 is an hour.
