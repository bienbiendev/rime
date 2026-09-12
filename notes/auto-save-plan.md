# Auto-save on versioned documents

Plan for the open TODO line `Handle auto-save if version enabled`. Second pass — the first is in
this file's history. It folds in the review: one auto-saved row per document **per user**, a
banner when a document is opened, the question of where the metas columns live, a complete table
of what `draft` means, and every scenario found that touches the design.

## 0. The design in one screen

- `versions: { draft: true, autoSave: true }` opts a config in. `autoSave` without `draft` is a
  config error.
- The versions table gains `isAutoSave` (boolean, not null, default false).
- An auto-save is a **panel-only** update that writes the requesting user's auto-saved row of the
  document: inserted from the row on screen the first time, updated in place after that. At most
  one per (document, user); `updatedBy` says whose it is.
- Every ordinary read skips auto-saved rows. They are reachable by `versionId` only, and only the
  panel ever names one.
- Opening a document loads what everyone sees, plus a footer banner: _you have an auto-saved
  version from …_ (resume / discard) or _X has an auto-saved version_.
- A save from the document form promotes the row it lands on (`isAutoSave: false`) and retires
  the saver's own auto-saved rows. REST updates do neither, and are not filtered by any of it.
- Nothing is pruned on a timer. A row lives until its owner discards it, edits over it, saves,
  or the document is deleted. The versions history lists it, labelled _auto-save by {name}_.

---

## 1. Tour: what is on disk

### 1.1 Repo shape

| Area                         | Where                                          | What                                                                     |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Config, prototypes, pipeline | `src/lib/core/`                                | isomorphic core; `*.server.ts` is the server half                        |
| Versions feature             | `src/lib/core/prototype/shared/versions/`      | config, naming, strategy, hooks, read/write plans                        |
| Metas feature                | `src/lib/core/prototype/shared/metas/`         | `createdBy`, `updatedBy`, the edit lock, timestamps                      |
| Adapter                      | `src/lib/adapter-sqlite/`                      | drizzle; reads/writes a _base_ row plus a _content_ row                  |
| Panel                        | `src/lib/panel/`                               | Svelte 5; `context/documentForm.svelte.ts` is the form state             |
| Fixtures                     | `tests/<name>/lib/+rime/rime.config.server.ts` | `bun run rime:use <name>` copies one to `src/lib/+rime`                  |
| e2e                          | `tests/<name>/api.test.ts`                     | Playwright `request` fixture against `vite dev`; `bun run test:versions` |
| Unit                         | `*.spec.ts` beside the code                    | vitest                                                                   |

`bun install` first: a fresh clone has no `node_modules`.

### 1.2 Versions, as stored

- A versioned config derives a collection `$<slug>__versions` (`configure.server.ts`) whose
  fields are the base config's non-`._root()` fields. Its slug is stamped on the base config as
  `_versions.slug` (`augment.ts`); the adapter and the pipeline find the second table through it.
- The schema generator (`adapter-sqlite/generate-schema/index.server.ts:52-89`) builds two
  tables: the base keeps `createdAt`, `updatedAt` and every `._root()` field; the versions table
  gets everything else plus `ownerId → base.id` (cascade). Blocks, tree and relations hang off
  the versions table.
- `augmentVersions` normalises `versions` to `{ draft, autoSave, maxVersions }` and, when
  `draft` is on, pushes `text('status').defaultValue('draft').hidden()`. That is how a feature
  adds a column to every versions table.
- `autoSave` is normalised (`augment.ts:36`) and read nowhere else. Enabling it today does
  nothing.
- `hidden()` is a panel concern only. Any hidden field is writable through a request body —
  `ButtonStatus.svelte` publishes with `PATCH { status }`. A flag the server must own has to be
  **stripped** from incoming data.

### 1.3 Versions, as read

`read-query.ts` says which content row a read means; the adapter takes "the newest by
`updatedAt`" when handed nothing:

```
versionId given          that row, whatever its status
no drafts in config      no narrowing → newest row
intent 'original'        the published row
a read                   the published row, unless draft=true → newest row
```

`versionId` is put on every versioned document by `exposeVersionId`, from the adapter's
`contentId`.

### 1.4 Versions, as written

`runUpdate` (`pipeline/run.server.ts:255`) runs the `beforeUpdate` list, builds the write plan,
writes, persists blocks/tree/relations against `context.contentOwnerId`, rereads, runs
`afterUpdate`. The list is hand-written in `collection/hooks.server.ts:95-117` and
`area/hooks.server.ts:45-56`. The versions hooks, in order:

1. `getOriginalDocument` (core): reads the original with `intent: 'original'` plus the
   request's `versionId`/`draft` → `context.originalDoc`.
2. `defineVersionOperation` → `context.versionOperation` (the five are documented on the hook).
3. `handleNewVersion` (`beforeUpsert`): a specific-version op sets `contentOwnerId` to the
   original's `versionId`; a new-version op builds the row from the submission _as sent_, fills
   unsent fields from `originalDoc` (`fallbackDataFromOriginal`), forces `status: draft` unless
   sent, strips child ids, inserts through `rime.collection('$x__versions').create()`, then
   prunes `status != published` rows past `maxVersions` by `-updatedAt`.
4. `stampUpdatedBy`, `buildDataConfigMap` (its keys are the only paths the write may touch),
   `setDefaultValues`, `validateFields` (required check, per-field write access).
5. `demoteOtherVersions`: on a specific-version op carrying `status: published`, sets every
   other row of the document to `draft` through `contentOwner(slug).updateWhere` — no
   `updatedAt` moves.

### 1.5 Entry points

- REST: `PATCH /api/<slug>/<id>?draft=&versionId=` → `restUpdateById` → `updateById`; area
  `PATCH /api/<area>`. `GET` reads parse the same two. Nothing else about versions is parsed.
- Panel form actions `?/update` (`collection-document/actions.server.ts:66`,
  `area/actions.server.ts:11`) read the same two params, call the local API, and on `draft`
  answer with a redirect to `/versions?versionId=<new>` (the area does a 303).
- `documentForm.svelte.ts`: `changes = diff(initialDoc, doc)`; `prepareData` sends only the
  changed top-level keys; `enhance` reads the submit button (`data-status` sets `status`,
  `data-draft` appends `&draft=true`, else `&versionId=<doc.versionId>`); `submit()` guards on one
  `processing` flag and on success **replaces `doc` and `initialDoc` with the server document**.
- `Document.svelte`: leave dialog while `changes` is non-empty; ctrl-s; the edit lock is claimed
  on mount and renewed at half `EDIT_LOCK_TTL_MS` through `POST /api/<slug>/<id>/lock`, which
  reads the **newest** row (`system().findById({ draft: true })`) and writes the two lock
  columns on it via `updateWhere`. A lock change fans out over SSE → `invalidateAll`.
- Panel loads read `draft: true` (`collection-document/load.server.ts:63`,
  `area/load.server.ts:43`, `collection/load.server.ts:41`). The page keys the form on
  `doc.id + doc.versionId + locale`.
- `Versions.svelte` lists rows from
  `GET /api/<slug>--versions?where[ownerId][equals]=<id>&sort=-updatedAt&select=updatedAt,status`.

### 1.6 Findings that shape the second pass

- **`updatedAt` and `updatedBy` come from different rows.** `mergeContentRow`
  (`adapter-sqlite/columns.server.ts:191`) drops the content row's `createdAt`/`updatedAt`, so
  a document's `updatedAt` is the **base** row's, while `updatedBy` is the **version** row's.
  Every write bumps the base `updatedAt` (`updatePrototype` → `writeRow`), including a write to
  an old version. The default list sort is the base `updatedAt` (`order-by.server.ts:52`).
- **`?draft=true` is gated by `access.read` alone** (`restGet`, `restGetById`, the area GET).
  `/api/<slug>--versions` inherits the base collection's access (`configure.server.ts`). On a
  collection with `read: () => true` every draft is public, by id, by list, and by version.
- **`_updatedByName` / `_createdByName` are read** (`Document.svelte`, `Row.svelte:92`) **and
  populated nowhere.**
- `demoteOtherVersions` keys on specific-version ops, so `PATCH ?draft=true { status: published }`
  leaves two published rows. The panel never does it; the API can.
- `handleNewVersion`'s `maxVersions` prune runs `delete` with the requester's access, not
  `system()`: a config narrowing `access.delete` below `isStaff` fails its editors' thirteenth
  draft with a 401.
- `duplicate.normalizeProps` strips `createBy` (typo). Harmless — `stampCreatedBy` overwrites.
- A `create` propagates the created locale's content into every other locale (`create.ts:96`),
  and a new version is a `create` on the versions collection. What a new version's other locales
  hold needs checking before auto-save leans on it (§5, scenario 15).
- `hook-placement.spec.ts` (cited in comments) and `docs/pipeline-map.md` (in `.prettierignore`)
  do not exist.
- The three `@TODO` doc holes on `PARAMS.DRAFT`, `defineVersionOperation` and
  `isSystemOperation` are filled in this branch.

---

## 2. What `draft` means, everywhere it is read

Config kinds: **D** = `versions: { draft: true }`, **V** = `versions: true` (no drafts),
**N** = no versions. `draft` is only ever meaningful on **D**; on **V** and **N** it is read and
ignored. "Newest" is by the version row's `updatedAt`. `versionId` always wins over `draft`.

### Reads — `findById`, area `find`, `GET /api/<slug>/<id>`, `GET /api/<area>`

| config | `draft`         | `versionId` | row returned                                       |
| ------ | --------------- | ----------- | -------------------------------------------------- |
| D      | absent or false | –           | published; 404 when there is none                  |
| D      | true            | –           | newest, whatever its status                        |
| D      | any             | v           | v, whatever its status                             |
| V      | any             | –           | newest                                             |
| V      | any             | v           | v                                                  |
| N      | any             | any         | the document's own row; `versionId` is meaningless |

### Lists — `find`, `GET /api/<slug>`

Same per document; a document with no matching row is **dropped** (a never-published document is
absent from a published list). `sort` on `createdAt`/`updatedAt` uses the base row; any other
column resolves to the table that has it.

### Updates — `updateById`, area `update`, `PATCH`

| config | `draft`         | `versionId` | operation                  | reads (original)   | writes                                                            |
| ------ | --------------- | ----------- | -------------------------- | ------------------ | ----------------------------------------------------------------- |
| D      | any             | v           | `UPDATE_VERSION`           | v                  | v in place                                                        |
| D      | true            | –           | `NEW_DRAFT_FROM_PUBLISHED` | published (404 §1) | a new row from published + body; `status` from body, else `draft` |
| D      | absent or false | –           | `UPDATE_PUBLISHED`         | published (404)    | the published row in place                                        |
| V      | any             | v           | `UPDATE_VERSION`           | v                  | v in place                                                        |
| V      | any             | –           | `NEW_VERSION_FROM_LATEST`  | newest             | a new row from newest + body                                      |
| N      | any             | any         | `UPDATE`                   | the row            | the row                                                           |

Publishing is `status: published` in the body on a specific-version op; only then are the other
rows demoted. Unsent fields of a new row come from the original; sent fields win.

### Everything else

| caller                      | `draft`                    | note                                                                                        |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| `create`, `POST`            | not read                   | `status` from body else default `draft`; an area's bootstrap row is published               |
| `deleteById`, `delete`      | not read                   | reads the newest row for the hooks, deletes the base row, cascade takes all                 |
| `duplicate`                 | forces `true`              | copies the newest row per locale; copy created as a draft                                   |
| lock `POST`/`DELETE`        | forces `true` (system)     | the lock is written on the newest row                                                       |
| upload file-reference check | forces `true`              | asks whether any document's newest row still names a filename                               |
| panel document load         | `true` + URL `versionId`   | the newest row, or the one in the URL                                                       |
| panel list load             | `true`                     | newest row per document                                                                     |
| panel save button           | –, `versionId` = on screen | `UPDATE_VERSION`                                                                            |
| panel "save in a new draft" | `true`, no `versionId`     | `NEW_DRAFT_FROM_PUBLISHED` — unsent fields come from published, not from the row on screen  |
| panel status dialog         | `true` + `versionId`       | `versionId` wins → in-place status change                                                   |
| live page load              | URL `versionId` only       |                                                                                             |
| access                      | `access.read` only         | no staff gate on drafts                                                                     |
| API cache                   | key includes `draft`       | GET only, never panel routes, per user email/roles, cleared only by `POST /api/clear-cache` |

---

## 3. Where the metas live

### What is there

| column                 | table (D/V config)    | how it moves                                  | what the document shows                |
| ---------------------- | --------------------- | --------------------------------------------- | -------------------------------------- |
| `createdAt`            | base **and** versions | base: once; versions: once per row            | base's (merge drops the version's)     |
| `updatedAt`            | base **and** versions | base: every write; versions: that row's write | **base's** (merge drops the version's) |
| `createdBy`            | base (`._root()`)     | once, `stampCreatedBy`                        | base's                                 |
| `updatedBy`            | versions              | per row, `stampUpdatedBy`                     | **the version row's**                  |
| `currentlyEditedBy/At` | versions              | `updateWhere` on the newest row               | the row read                           |

So a document read by `versionId=v2` reports `updatedBy` = whoever wrote v2 and `updatedAt` = the
last time _any_ row was written. The two are supposed to be one fact. And the lock, declared
per-revision in `metas/module.ts`, is in practice per-document: the endpoint always writes the
newest row.

### Options

- **A. Split by question.** `created*` describe the **document** and stay on the base row.
  `updated*` describe the **version** and both come from the version row: `mergeContentRow` keeps
  the content row's `updatedAt` and drops the base's. The base `updatedAt` remains an internal
  "last touched" column the default list sort uses, never merged into a document. One line in the
  merge, one spec, a handful of e2e expectations. Cost: none on disk.
- **B. All on the versions table.** `createdBy` loses `._root()`; each row says who cut it and
  when; the document's creation is its oldest row. Consistent, but "who made this document" stops
  being one column, `A new version keeps createdBy` (e2e) inverts, the FK moves, and every merged
  read still needs a base `updatedAt` for the list sort or a correlated subquery instead.
- **C. Keep both and expose both.** `updatedAt` (version) and `_touchedAt` (base). Two dates on
  a document is the oddness you pointed at.

**Recommendation: A**, and move the lock to the base row while at it (`._root()` on both lock
fields, `writeLock` through the base handle, `lock.server.ts` no longer needs a `versionId`).
With one auto-saved row per user the lock has to be one per document or it stops meaning
anything: the panel of the person on their auto-saved row and the panel of the person on the real
row must see the same claim. That reverses the per-revision rationale in `metas/module.ts`; the
rationale changes because the rows do. It is a migration (two columns move), landed on its own.

Also part of this step: a `beforeRead` hook on panel reads that resolves `createdBy`/`updatedBy`
to `_createdByName`/`_updatedByName` from `staff`. The banner says "by X", and today X is blank.

---

## 4. Design

### 4.1 Identity

An auto-saved row is a row of `$<slug>__versions` with `isAutoSave = true`. Its owner is
`updatedBy`. Invariant: at most one per `(ownerId, updatedBy)`. Always `status: draft`.

The column: `toggle('isAutoSave').defaultValue(false).hidden()` pushed by `augmentVersions` when
`autoSave` is on, generated **not null with default false** so the migration backfills existing
rows — a nullable column would make the `!= true` filter below drop every pre-existing version
(`NULL != 1` is not true in SQLite). Verify `column.server.ts` emits that from the builder; if
not, give the generator a way to say it.

### 4.2 Writing one

`updateById` / area `update` gain `autoSave?: boolean`, carried on `context.params`. The REST
handlers never set it. The panel actions do.

`defineVersionUpdateOperation` gains `autoSave` and `originalIsAutoSave`, tested first:

```
autoSave, no versionId, or config not opted in        error (BAD_REQUEST)
autoSave, original is the caller's own auto-saved row  UPDATE_VERSION            (in place)
autoSave, original is a real row                       NEW_AUTO_SAVE_FROM_VERSION
```

`handleNewVersion`:

- `NEW_AUTO_SAVE_FROM_VERSION`: delete the caller's existing auto-saved row of this document, if
  any (the invariant), then insert as a new version does — original's content, submission on top —
  with `status: draft`, `isAutoSave: true`. No `maxVersions` prune.
- `UPDATE_VERSION` with `autoSave`: force `status: draft`, `isAutoSave: true` on the data.
- any other specific-version op: set `isAutoSave: false` on the data. That is the promotion.
- new real rows: `isAutoSave: false`, so a draft branched from anything never inherits the flag.

Guards, as versions hooks placed first in both prototypes' lists:

- `stripAutoSaveFlag` (`beforeUpsert`): `delete data.isAutoSave` — the server owns it.
- `guardAutoSaveOwner` (`beforeUpdate`, `beforeDelete`): an auto-saved row is written or deleted
  by its owner only, or by a system call. Anyone else gets `UNAUTHORIZED`.

### 4.3 Reading, and where auto-saved rows are filtered

The rule is one clause in `versionsReadQuery`, for an opted-in config with no `versionId`:
`isAutoSave != true`, `and`ed with the published filter where one applies. Every reader below
goes through it, so none of them needs to know the feature exists:

| reader                                                   | today                   | with auto-save                                                                                                      |
| -------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `findById` / area `find`, no `draft`                     | published               | published — unchanged, auto-saved rows are drafts                                                                   |
| `findById` / area `find`, `draft: true`                  | newest                  | newest **real** row                                                                                                 |
| `findById` / area `find`, `versionId`                    | that row                | that row, even auto-saved — the panel's resume                                                                      |
| `find` lists, panel list, nested children                | per document            | newest real row per document                                                                                        |
| `getOriginalDocument` (intent `original`)                | published / `versionId` | unchanged                                                                                                           |
| `duplicate`                                              | newest                  | newest real row — never copies an auto-save                                                                         |
| lock endpoints (`draft: true`, system)                   | newest                  | newest real row (moot once the lock is on base)                                                                     |
| upload file-reference check (`draft: true`)              | newest                  | newest real row — see scenario 11                                                                                   |
| `deleteById`'s pre-read (`adapter.find`, no filter)      | newest                  | may be an auto-saved row; only its `filename` is read, cascade takes all rows                                       |
| `maxVersions` prune in `handleNewVersion`                | `status != published`   | `and` `isAutoSave != true`                                                                                          |
| `demoteOtherVersions`                                    | all other rows          | unchanged — they are drafts already                                                                                 |
| `/api/<slug>--versions` (the versions collection itself) | all rows                | all rows — the panel's history list shows them labelled _auto-save by {name}_; the collection reads `isStaff` (D11) |
| API cache                                                | keyed per user          | unchanged: filtered responses never contain one                                                                     |

`isAutoSave` is exposed on the document (`versionsDocType` adds `isAutoSave?: boolean`) so the
panel can tell a resumed row from a real one.

### 4.4 Promotion and retirement

- **Promotion** is any non-auto-save update landing on an auto-saved row (`UPDATE_VERSION` with
  `isAutoSave: false` set by `handleNewVersion`). The panel's Save, Publish and the status dialog
  all do it, because they all send `versionId` = the row on screen.
- **Retirement** is the deletion of the saver's other auto-saved rows of the document. It is not
  a pipeline hook: a helper `retireAutoSaves({ config, docId, userId, keep })` in the versions
  feature, called by the **two panel form actions** after a successful non-auto-save update,
  through `system()` (bookkeeping, not a permission the editor holds). REST cannot reach it, and
  a panel list reorder or a status PATCH — REST calls — does not trigger it either.

### 4.5 Lifetime

No timer, no scheduler (rime has none; the only `setInterval` is the SSE keep-alive). The
invariant bounds the table at one row per user per document, and a row goes away when:

- its owner **discards** it — the banner, or the history list entry;
- its owner **edits over it** — the first auto-save from another base row replaces it (4.2);
- its owner **saves** — promotion, or retirement of the others (4.4);
- the **document is deleted** — cascade;
- a staff member with `access.delete` discards it from the history list — the only exit for a row
  whose owner was deleted (`updatedBy` set null by the FK).

### 4.6 The panel

**Load** (collection document and area): read the document as today (filtered → the real newest
row, or the URL's `versionId`). When the config opts in, also query
`$x__versions` (system) for `ownerId = doc.id and isAutoSave = true`, selecting
`id, createdAt, updatedAt, updatedBy`, and hand the page:

```ts
autoSaves: {
  own?: { id; createdAt; updatedAt; outdated: boolean };
  others: { id; updatedAt; updatedBy; _updatedByName }[];
}
```

`outdated` = the real row's `updatedAt` (the version row's, after §3) is later than
`own.createdAt`: somebody wrote the document after this auto-save started.

**Banner** (`AutoSaveBanner.svelte`, footer of `Document.svelte`):

- own, not outdated: _You have an auto-saved version from {time}._ **Resume** · **Discard**
- own, outdated: _… The document has been saved by {name} since._ **Resume** · **Discard**
- others: _{name} has an auto-saved version from {time}._ (no action)
- on a resumed row: replaces the banner with a header tag _Auto-saved draft — not a version yet._
  and a link back to the document.
- the banner goes away as soon as the form has `changes`: the user chose to start over, and the
  first auto-save replaces the old row by the invariant. No confirmation.

Resume → `goto(?versionId=<own.id>)`. Discard → `DELETE /api/<slug>--versions/<id>` (the owner
guard in 4.2 covers it) then `invalidateAll`. A resumed row loaded by somebody who is not its
owner is served `readOnly`.

**Form** (`documentForm.svelte.ts`):

- `isAutoSave = config.versions?.draft && config.versions?.autoSave && operation === 'update'
&& !readOnly`. Never on create, never on a nested (relation) form. Live edit included: it is the
  same form context, one rule (D9). The live preview builds its URL from `doc.versionId`
  (`live.svelte.ts:201`), so once an auto-saved row exists the iframe follows it on the next
  rebuild.
- One `send(action, formData, { silent })` plus a one-slot queue: a manual submit during an
  auto-save waits, then runs. `processing` stays for manual saves; new
  `autoSaveState: 'idle' | 'saving' | 'saved' | 'paused'` and `lastAutoSavedAt`.
- `$effect` on `changes`: when `isAutoSave && !isDisabled && !hasError && hasChanges`, 1500 ms of
  quiet, then send to `buildPanelActionUrl() + &autoSave=true&versionId=<doc.versionId>`.
  Cancelled by a manual submit and on destroy.
- Response: **merge, never replace.** Snapshot `sent` before sending; on success
  `initialDoc = serverDoc`, `doc = serverDoc` with every path in `diff(sent, doc)` re-applied on
  top. `versionId`, `isAutoSave`, `updatedAt` and child ids come from the server; what was typed
  during the round trip survives.
- When the returned `versionId` is new, `replaceState` it into the URL. No `invalidateAll` — it
  remounts the form through the page's `{#key}` and drops focus.
- On failure: `paused`, with the reason (a `required` error names its field); no toasts; nothing
  retries until `changes` moves again.
- `canSubmit` also true when `doc.isAutoSave`: after an auto-save `changes` is empty and Save must
  still promote. That submit carries an empty body; the server writes `status`, `updatedBy`,
  `isAutoSave: false` and nothing else — children are outside `incomingPaths`.
- "Save in a new draft" while on a resumed row sends `versionId` (a promotion), not `draft=true`
  — `NEW_DRAFT_FROM_PUBLISHED` would rebuild the row from published and lose every field the
  auto-save changed but this session did not.

**Panel actions**: parse `PARAMS.AUTO_SAVE`; pass `autoSave`; for an auto-save return
`{ document }` only — no message, no redirect, no 303. After a manual save, `retireAutoSaves`.

**Header**: saving / saved-at / paused indicator beside the buttons; the resumed-row tag.

**Leave** (`Document.svelte`): with auto-save on and `changes` pending, `await flushAutoSave()`
and let the navigation through; on failure fall back to the dialog. `pagehide` → `sendBeacon` of
the same form data to the auto-save action (optional; a lost beacon costs one debounce window).

**Versions history** (`Versions.svelte`): the query selects `updatedAt,status,isAutoSave,updatedBy`
and the rows render dimmed with the label _auto-save by {name}_ (own: _your auto-save_). Opening
one is the same as Resume; for somebody else's row the document is `readOnly`. The owner, or a
staff member with `access.delete`, gets a discard control on the entry. `DocVersion` in
`panel/index.ts` gains `isAutoSave` and `updatedBy`.

**i18n** `en`/`fr` `common`: `auto_saving`, `auto_saved_at`, `auto_save_paused`,
`auto_saved_draft`, `auto_save_banner_own`, `auto_save_banner_own_outdated`,
`auto_save_banner_other`, `auto_save_resume`, `auto_save_discard`.

---

## 5. Scenarios

Each: what happens under the design, and the decision it rests on.

1. **An API `PATCH` lands while U is editing in the panel** (U's auto-saved row A_U exists).
   The API writes R (in place or a new real row). A_U is untouched; nothing retires it; U's tab
   is not told (SSE carries lock changes only). On U's next load the banner says the document
   changed since. If U keeps typing and saves, A_U is promoted as a sibling version of the API's
   row — no merge, and whichever is published last wins, which is the versions model today.
   Optional later: an SSE `rime:update` event so the open tab can warn immediately.
2. **The same user updates through the API** (a script, an API key). Retirement is panel-only,
   so their auto-saved row stays and reads as outdated next time. Deliberate: "API updates may
   not interfere" cuts both ways.
3. **V takes control.** The forced claim moves the lock (per document after §3); SSE →
   `invalidateAll` in U's tab → U is `isLockedByOther`, the form is disabled and the auto-save
   effect stops on the same guard. A_U survives. V edits, gets A_V, saves: only V's rows are
   retired. U comes back: banner, outdated, resume or discard. Resume-then-save promotes A_U as
   a new version beside V's; V's changes are not merged into it.
4. **U leaves without saving.** `beforeNavigate` flushes an auto-save and lets the navigation
   through; the dialog appears only if the flush fails. Coming back, U sees the real document
   plus the banner (D5). The alternative — landing U on A_U directly with "this is an auto-save
   of <link>" — is one line in the load, but it would move somebody onto an unsaved row without
   asking, and onto an outdated one after scenario 1.
5. **Crash, power loss, closed laptop.** At most one debounce window is lost. Same return path.
6. **Two tabs, same user.** Both write A_U in place; each sends its own `changes`, so the last
   write per field wins — the same as two tabs with manual saves today.
7. **Publish from a resumed row.** Save with `data-status=published` → `UPDATE_VERSION` on A_U →
   `isAutoSave: false`, published, the others demoted, own rows retired. Unpublish via the
   status dialog (`PATCH ?draft=true&versionId=A_U`) → `versionId` wins → promotion through REST
   by the owner. Allowed by the guard.
8. **"Save in a new draft."** On a resumed row: sent as a promotion (4.6). On a real row while
   A_U exists: a new draft is created and A_U retired.
9. **A required field is emptied.** `validateFields` refuses the auto-save (400). State
   `paused: title is required`; no retry until the field changes; a manual save shows the same
   error as today.
10. **Server or network error.** `paused`; local state kept; the leave dialog is back.
11. **The document is deleted.** Cascade removes every row including auto-saved ones. On an
    upload collection the "is this file still referenced" check reads newest real rows only, so
    a file that only an auto-saved row of _another_ document still names could be removed from
    disk. Upload collections are excluded from `autoSave` in this pass (D7); lifting that means
    teaching `isFilenameStillReferenced` to include auto-saved rows.
12. **Duplicate.** Reads the newest real row; never copies an auto-save.
13. **Tree reorder from the list** while A_U exists. `PATCH ?versionId=R { _parent, _position }`
    — REST, so no retirement; `_parent`/`_position` are `._root()` and not on version rows at
    all. A_U reads as outdated next time; a later promotion of A_U does not touch hierarchy.
14. **`maxVersions`.** Auto-saved rows are neither counted nor pruned. A promotion adds one real
    draft, and the next new-version write prunes as today.
15. **Locales.** An auto-save carries `locale`; the row's other locales come from whatever a new
    version's other locales come from today (`create.ts:96` copies the created locale into the
    others — check against the multilang suite before relying on it). A locale switch reloads
    the page; the banner is per document, not per locale.
16. **Areas.** Same path through `area/load.server.ts` and `area/actions.server.ts`. The
    bootstrap row has `isAutoSave: false` by default.
17. **Live edit** shares the form context and auto-saves by the same rule (D9). The iframe
    already pushes every change through `onDataChange`; the auto-save is a second, slower
    channel and does not touch the preview. The preview URL carries `doc.versionId`, which
    becomes the auto-saved row's id after the first auto-save.
18. **Lock lost silently** (tab asleep past the TTL, another editor claims). The next SSE lock
    event reloads the tab into `isLockedByOther`; the auto-save guard stops with it. Until then
    an auto-save from a lock-less tab is accepted — the server checks ownership of the row, not
    the lock, which is the same as a manual save today.
19. **Auto-saving while looking at an older version** (`?versionId=v1` from the history page).
    The first auto-save creates A_U from v1 and, by the invariant, deletes the A_U that was based
    on R. The banner on that page already says an auto-save exists and gains _editing here
    replaces it_; it disappears on the first change (D10).
20. **Somebody opens another user's auto-saved row by URL.** The read succeeds (versions are
    readable); the load marks it `readOnly` when `doc.isAutoSave && doc.updatedBy !== user.id`,
    so no auto-save is attempted and none would be accepted.
21. **The owner is deleted.** `updatedBy` is `set null` by the FK; the row is nobody's, reads as
    "someone" in others' banners and in the history list, and stays until a staff member with
    `access.delete` discards it there (4.5).
22. **Access.** Ordinary reads filter auto-saved rows, but `GET /api/<slug>--versions` lists them
    and `?versionId=` reads them, both behind `access.read` — which on a public collection is
    everyone, and already exposes every draft (§1.6). Two fixes, either before or with this: the
    derived versions collection gets `read: isStaff` by default (breaking for anyone reading it
    anonymously), or its list drops `isAutoSave` rows for non-staff. The first is the honest one.
23. **Migration.** Opting in adds the column; `rime generate` writes the drizzle migration with
    the not-null default so existing rows read `false`. A config that opts out later keeps the
    column until the next generate.
24. **Codegen.** `isAutoSave?: boolean` on the document type; `DocVersion` in `panel/index.ts`
    gains it; `select` on the versions endpoint may name it.
25. **Cache.** Unchanged: GET only, never panel, per user, and a filtered response never carries
    an auto-saved row. A cached `?versionId=A_U` read is possible for staff — the same staleness
    manual saves have today (the cache is cleared only by `POST /api/clear-cache`).
26. **Relation "create" dialogs** are nested creates: never auto-saved.
27. **Uploads on a resumed row** — excluded by D7 for now.
28. **The panel list** shows the newest real row; an in-progress auto-save never appears in a
    list or a card, and `_updatedByName` there stays blank until §3's resolver lands.

---

## 6. Work, in commit order

- **C0 — docs (this branch).** The three `@TODO`s: `PARAMS.DRAFT`, the five operations on
  `defineVersionOperation`, `isSystemOperation`. Done.
- **C1 — validation.** `validateVersions` in `core/config/validate.server.ts`: `autoSave` needs
  `draft`; `autoSave` on an `upload` collection refused (D7). Spec beside it.
- **C2 — metas.** (a) `mergeContentRow` keeps the version row's `updatedAt`; spec on
  `columns.server.ts`; e2e expectations on `updatedAt` reviewed. (b) Lock fields `._root()`,
  `writeLock` on the base handle, `lock.server.ts` without `versionId`; `metas/module.ts` rewritten
  to say why. (c) `resolveAuthorNames` `beforeRead` for panel reads → `_createdByName`,
  `_updatedByName`. Three commits; (b) is the migration.
- **C3 — the column and its guards.** `augment.ts` pushes `isAutoSave`; generator emits not null
  default false; `doc-type.ts` contribution; `stripAutoSaveFlag`, `guardAutoSaveOwner` placed in
  both hook lists; `augment.spec.ts`. Fixtures: `news` opts in (`pdf` stays out — upload).
- **C4 — server operations.** `strategy.ts` (+ `strategy.spec.ts` table); `handleNewVersion`
  (replace / in place / promotion / no prune); `read-query.ts` clause (+ spec rows); `maxVersions`
  query uses `where[and]`; `retireAutoSaves` helper; `OperationContext.params.autoSave`;
  `updateById` / area `update` args; api forwarding. Also the versions collection `read: isStaff` default (§5.22),
  with its own changeset line.
- **C5 — panel actions.** `PARAMS.AUTO_SAVE`; parse, forward, silent response; `retireAutoSaves`
  after a manual save; both loads return `autoSaves`; resumed rows of another owner `readOnly`.
- **C6 — form, banner, history.** Everything in 4.6, live edit included; i18n both locales.
- **C7 — changeset, `notes/TODO.md`, rime-doc.**

e2e, `tests/versions/api.test.ts`, driving the panel actions over HTTP with the suite's cookie
(the only door to an auto-save):

1. first auto-save on a published `news` → a new row, `isAutoSave: true`, `status: draft`;
   `GET /api/news/<id>` and `GET /api/news/<id>?draft=true` both still return the old title.
2. second auto-save naming that row → same row count, updated in place.
3. auto-save with `status: published` in the body → still `draft`.
4. a second user's auto-save on the same document → a second row; the first untouched.
5. manual save from the panel action naming the row, `status: published` → `isAutoSave: false`,
   published, the saver's other auto-saved rows gone, the other user's still there.
6. `PATCH` with `isAutoSave: true` in the body → written row reads `false`.
7. `PATCH ?autoSave=true` on REST → an ordinary update; no auto-saved row.
8. another user's `PATCH ?versionId=<someone's auto-save>` → 401.
9. `?draft=true` reads, list reads and `duplicate` never return or copy an auto-saved row.
10. `maxVersions` on a fixture with `autoSave` (a non-upload one, e.g. `pages`) ignores the rows.
11. `DELETE /api/<slug>--versions/<id>` on an auto-saved row: 200 for its owner, 401 for another
    editor; `GET /api/<slug>--versions` answers 401 without staff credentials on a public
    collection (D11).
12. `updatedAt` on a `?versionId=v1` read equals v1's own write time (C2a).

Unit: `strategy.spec.ts`, `read-query.spec.ts` rows, `augment.spec.ts`, `validate` spec,
`columns.server.ts` merge spec.

---

## 7. Decisions

| #   | Choice                                                                                             | Alternative                                     |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| D1  | One auto-saved row per (document, user), updated in place                                          | one per document; one per tick                  |
| D2  | Ordinary reads exclude auto-saved rows; `versionId` reaches them                                   | `draft: true` surfaces them as newest           |
| D3  | Listed in the versions history, dimmed, labelled _auto-save by {name}_; the banner is the shortcut | hidden from the list                            |
| D4  | Retirement = the saver's own rows, from the panel form actions only                                | every row; from any update                      |
| D5  | Opening a document shows the real document plus a banner                                           | land the owner on their auto-saved row directly |
| D6  | Metas: `created*` on the document, `updated*` on the version, lock on the document                 | all on the versions table; expose both dates    |
| D7  | Upload collections cannot opt in yet                                                               | include, and extend the file-reference check    |
| D8  | Never pruned on a timer; discard, edit-over, save and document deletion are the exits              | 7 days, on save and at boot                     |
| D9  | Live edit auto-saves by the same rule                                                              | gate on `!isLiveEdit`                           |
| D10 | Auto-saving from another version replaces the existing own row                                     | refuse until resumed or discarded               |
| D11 | The derived versions collection reads `isStaff` by default                                         | filter auto-saved rows for non-staff only       |

All eleven decided in review; the table is the record.
