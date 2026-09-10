# Plans — three TODO items

Written against the tree at `b348c82`. Each plan states what is actually on disk today (traced to
the line), then the work. The last section arbitrates between them.

---

## 1. `editedBy` → `currentlyEditedBy`, plus `lastEditedBy` / `createdBy`

### What is there today

`augmentMetas` — `core/prototype/shared/metas/augment.ts:10` — appends three hidden fields to every
collection and area:

```ts
text('editedBy').hidden(),
date('createdAt').hidden(),
date('updatedAt').hidden()
```

`editedBy` holds a **user id**, and it is written in exactly one place: the `takeControl()` PATCH in
`panel/components/sections/document/CurrentlyEdited.svelte:17`. No hook writes it on open, and no
hook writes it on save — `grep -rn editedBy src/` returns six hits and none of them is a write path.

So the lock as shipped:

- never engages by itself (opening a document claims nothing),
- once claimed, is claimed forever — no TTL, no release on navigate away, no release on save,
- is cleared only by the next person pressing **Take control**, which then locks the first one out.

Two more defects sit on the same value, both in `Document.svelte`:

- **line 166** renders it through a date formatter — `locale.dateFormat(form.values.editedBy)` on a
  32-char id. Whatever that prints, it is not a name and not a date.
- the key it prints under, `common.edited_by`, **does not exist** in `core/i18n/en/common.js` or
  `core/i18n/fr/common.js`. The label is a raw key today.

And `build-document.server.ts:90` strips the value on any read that is not a panel read with a user,
so the API never sees it.

### Why the rename is the smaller half

The rename is mechanical: six call sites. What the TODO is really asking for is **three values with
three different lifetimes**, currently collapsed into one:

| value | written when | read by |
| --- | --- | --- |
| `createdBy` | once, on create | list column, audit |
| `lastEditedBy` | every successful write | list column, audit |
| `currentlyEditedBy` | on open, released on leave/save/TTL | the lock overlay only |

Only the third is ephemeral. Keeping it in the same shape as the other two is what makes the current
one confusing — a field that means "someone is in here right now" is stored exactly like a field
that means "this is who made it".

### Plan

1. **Fields.** In `augmentMetas`, replace `text('editedBy')` with three fields. `createdBy` and
   `lastEditedBy` are relations to `STAFF_SLUG` (`core/auth/tables.ts:23`), not text — that is what
   lets the panel render an email without `CurrentlyEdited`'s ad-hoc `fetch(apiUrl('staff', by))`,
   and what lets `depth=1` populate them for API consumers. `currentlyEditedBy` stays `text`,
   hidden, and gains a sibling `currentlyEditedAt` date so the lock can expire.
2. **Writers.** Two hooks, both in `core/prototype/shared/metas/`:
   - `beforeCreate`: set `createdBy` and `lastEditedBy` from `event.locals.user.id`.
   - `beforeUpdate`: set `lastEditedBy`, and clear `currentlyEditedBy` — saving is the natural
     release point. Guard both on `event.locals.user` (system operations and public writes have
     none) and on `isSystemOperation`, or seeding writes an owner nobody chose.
3. **Lock lifecycle.** Claim on document load (`panel/pages/collection-document/load.server.ts`)
   when nobody else holds it or the holder's `currentlyEditedAt` is older than a TTL — 5 minutes is
   the usual figure. Release on save (step 2) and on `beforeNavigate` in `Document.svelte:67`.
   The overlay condition at `Document.svelte:143` then becomes "held by someone else **and** not
   expired". `takeControl()` stays as the manual override, and drops its `staff` fetch.
4. **Read exposure.** `build-document.server.ts:90` currently deletes `editedBy` outside the panel.
   Keep that for `currentlyEditedBy` — it is UI state, not document data — and let `createdBy` /
   `lastEditedBy` through, which is the whole point of having them.
5. **Panel.** Fix the two bugs at `Document.svelte:165-167`: no `dateFormat` on an id, and add
   `created_by` / `last_edited_by` to both `common.js` files. Give the two relation fields
   `.table(n)` so they can be shown as list columns — the column list is built from any field
   carrying `table` (`panel/context/collection.svelte.ts:92-103`), so this is the entire cost of
   "user metas on the table". A relation column costs nothing extra on the list query either:
   `fields/relation/component/Cell.svelte` resolves the related document client-side through the
   API proxy, so the `find()` at `panel/pages/collection/load.server.ts:43` stays at depth 0.
6. **Migration.** Cheaper than it looks: a config change already triggers `drizzle-kit generate`
   then `drizzle-kit migrate` — `adapter-sqlite/generate-schema/write.server.ts:59-65` — so the
   column drop and the three additions are generated, not hand-written. Existing `editedBy` values
   are stale locks, not history; backfilling `lastEditedBy` from one would invent a fact.
7. **Test.** `tests/basic` — create as user A, assert `createdBy`; update as user B, assert
   `lastEditedBy` moved and `createdBy` did not; assert a stale lock is takeable after the TTL.

### Cost

Moderate and almost entirely mechanical. The one real decision is the TTL, and the one real risk is
step 2's guards — a hook that writes `lastEditedBy` on a system operation will stamp seeded and
migrated documents with whoever's request happened to trigger them.

---

## 2. Auto-save, and the confirm dialog when versions are off

### What is there today

`autoSave` is **declared and never read**. `augmentVersions` normalises it —
`core/prototype/shared/versions/augment.ts:36` —

```ts
autoSave: typeof versions === 'boolean' ? false : (versions.autoSave ?? false),
```

and `grep -rn autoSave src/` returns that line plus its type at `versions/types.ts:24`. Nothing
consumes it. Setting `autoSave: true` on a collection today changes nothing at all, silently.

What does exist is the opposite safety net: `Document.svelte:67-74` cancels navigation while
`form.changes` is non-empty and opens a confirm dialog. It runs for every config, versioned or not.

Saving itself is four scenarios in `Header.svelte:71-118` — no versions / versions without draft /
draft on a published doc / draft on a draft doc — each a different button with different
`data-status` and `data-draft` attributes, read back by
`documentForm.svelte.ts:646-665` to build the action URL.

### The constraint that shapes this

Auto-save is only safe where a save is **non-destructive**. That is exactly the draft case:

- `versions: { draft: true }` — an auto-save writes a new draft version. The published document is
  untouched, and `maxVersions` pruning already exists to stop the table growing
  (`handle-new-version.server.ts:66-72`, which prunes `status != published` by `-updatedAt` beyond
  the cap). **This is where auto-save belongs.**
- `versions: { draft: false }` — every save is a new *published* version. Auto-save here publishes
  half-finished edits to the live site. Wrong by default.
- no `versions` — every save overwrites the only row there is. Auto-save is straightforwardly
  destructive: no undo, and the confirm dialog exists precisely because of that.

So the TODO's two halves are one decision: **auto-save where drafts are on, confirm dialog
everywhere else** — and the two must be mutually exclusive, because a form that saves itself must
not also ask "you have unsaved changes".

### Plan

1. **Reject the impossible config.** In `core/config/validate.server.ts`, error on
   `autoSave: true` with `draft: false`. Today that combination type-checks and silently publishes.
   This is the first commit and it is worth landing on its own.
2. **Derive one flag** in the form context: `isAutoSave = config.versions?.draft && config.versions.autoSave && operation === 'update'`.
   Never on `create` — auto-save cannot invent an id, and half a document written on first keystroke
   is worse than no document.
3. **Debounced save.** In `documentForm.svelte.ts`, an `$effect` on `changes` that fires `submit()`
   after a quiet period (2s is the usual figure), with a hard guard on `processing` — the existing
   early return at line 577 stops overlap, but a queued trailing call is still needed or the last
   keystrokes before a slow save are lost. Route it through the same `enhanceAction` path with
   `data-draft` semantics so the write is a draft version, not a publish.
4. **Suppress the dialog when it is on.** `Document.svelte:68` returns early when `isAutoSave` —
   there is nothing to confirm. Keep it in every other scenario, which is the second half of the
   TODO and is already correct today; it just needs the guard.
5. **Show it.** A saving/saved indicator near the save button, and `ButtonSave` disabled or relabelled
   under auto-save. An editor that cannot tell whether their work is safe will not trust it.
6. **Version churn.** Auto-save turns one editing session into dozens of versions. Two options,
   and this is the design decision to make before writing step 3: either auto-saves **update the
   current draft version in place** (`versionId` present → `UPDATE_VERSION`, one row per session,
   the version list stays readable) or they each create a new one and lean on `maxVersions`. In
   place is almost certainly right — the version list is a history of intentional saves, and
   auto-save is not one.
7. **Interaction with the lock (item 1).** Auto-save writes without a human pressing anything. If
   the update hook clears `currentlyEditedBy` on write, an auto-save releases the lock every 2
   seconds while the editor is still typing. These two features must land in that order, or
   auto-save must be exempted from the release.
8. **Test.** `tests/versions` — type, wait, assert a draft version exists without pressing save;
   assert the published document did not move; assert the version count after N edits matches the
   choice in step 6; assert no leave-confirm dialog appears.

### Cost

The largest of the three, and the only one where the hard part is not the code. Steps 1, 2, 4 are an
afternoon. Step 3 is a debounce with real edge cases — in-flight saves, navigating mid-save, the
form state being replaced by the server response while the user is still typing into it
(`submit()`'s `doc = data?.document` at `documentForm.svelte.ts:600-601` will clobber keystrokes
that landed during the round trip). Step 6 changes what the version list means.

---

## 3. `select` on `findById`

### What is there today

**This is largely already built.** The parameter flows end to end:

- REST reads it — `collection/rest/get-by-id.server.ts:25`
- the local API caches on it and forwards it — `collection/api.server.ts:197-213`
- the operation passes it to the adapter — `collection/operations/find-by-id.ts:29-57`
- the adapter narrows columns and the `with` tree — `adapter-sqlite/read.server.ts:73,84,88-89`
- the merge respects it — `adapter-sqlite/columns.server.ts:159-182`
- and `readDocument` skips the blank merge when it is set (`run.server.ts:225,238`), without which
  a narrowed read would come back full of blank fields anyway.

Areas have it too (`area/api.server.ts:110-118`). So the TODO is stale — but not empty. Three real
gaps remain.

### The gaps

1. **`asTitle` is not resolved.** `restGet` augments the select list so that asking for `title` also
   asks for whatever field backs it — `collection/rest/get.server.ts:22-32`. The area endpoint does
   the same (`area/rest/get.server.ts:16`). `restGetById` does not. `GET /api/pages/<id>?select=title`
   therefore returns a document with no usable title, while the same select on the list endpoint
   works. One inconsistency, one fix, three lines.
2. **No test touches it.** Every `select` assertion in `tests/` is a list query —
   `multilang/api.test.ts:266,316,338,464,484`, `versions-multilang/api.test.ts:501,693`. Nothing
   exercises `select` on a by-id read, which is why gap 1 went unnoticed.
3. **It is untyped.** `select?: string[]` (`operations/find-by-id.ts:15`) — no autocomplete against
   the document's own paths, and the return type stays the full `Doc` even though a narrowed read
   demonstrably does not return one. Callers destructure fields that are not there and TypeScript
   agrees with them.

### Plan

1. Lift `buildSelect` out of `collection/rest/get.server.ts` into a shared helper and call it from
   `get-by-id.server.ts`. The area endpoint's copy folds into the same helper.
2. Tests, in `tests/multilang/api.test.ts` beside the existing list-select ones:
   `?select=attributes.title` by id, `?select=` on a nested path, `?select=title` asserting the
   asTitle resolution from step 1, and one on a versioned collection asserting the select applies to
   the version row and not just the base row.
3. *(optional, separate commit)* Type it: `select?: Array<DocPaths<Doc>>` with the paths generated
   the way codegen already generates doc types, and a return of `Pick<Doc, …>`. This is the only
   part with any real cost, and it is a developer-experience change rather than a capability.

### Cost

Steps 1-2 are an hour, most of it writing the tests. Step 3 is a day in the codegen and can wait
indefinitely.

---

## Which to pick

**Order: 3 → 1 → 2.**

### 3 first, because it is nearly free

An hour of work closes a real inconsistency — the same query string behaving differently on
`/pages` and `/pages/<id>` — and lets the TODO line be ticked honestly rather than staying open
against code that already exists. Leaving a done feature on the list costs more than the fix does.
Skip the typing (step 3) for now.

### 1 next, and it is the one that earns most per hour

Your instinct is right, and there is a concrete reason it is right beyond "users want it": the
panel's list already renders any field carrying `.table(n)`
(`panel/context/collection.svelte.ts:92-103`). So once `createdBy` and `lastEditedBy` are real
relation fields, **a "who made this / who last touched this" column is one chained call, not a
feature**. The infrastructure to display them is already paid for; only the values are missing.

It also fixes three things that are broken right now rather than merely absent:

- a user id being run through a date formatter (`Document.svelte:166`),
- a label printing a translation key that exists in neither locale file,
- a lock that never engages on its own and never releases once it does.

That last one matters more than the rename. As shipped, the "currently editing" overlay is not a
soft lock — it is a permanent one that only appears after someone presses *Take control*. Any
multi-editor install either never sees it or gets stuck behind it. Fixing that is not polish.

And it is a prerequisite for 2: auto-save and an edit lock write to the same document on the same
timer, and item 2's step 7 is unresolvable until item 1's release semantics exist.

### 2 last, but scoped down

Auto-save on versioned documents is the headline feature, and it is worth building — you are right
that it is the one users would notice. But three things argue for it going last:

- **It is the only one with an unresolved design question.** Step 6 — one draft row updated in
  place versus a new version per auto-save — changes what the version list means to an editor.
  That wants a decision, not an implementation.
- **Its failure mode is data loss**, and the specific mechanism is already visible in the code: a
  successful save replaces the form's document (`documentForm.svelte.ts:600-601`), so anything typed
  during the round trip is overwritten by the server's copy. Today that costs a keystroke on a
  deliberate save; on a 2-second timer it is a class of bug users will hit constantly and report as
  "it ate my paragraph".
- **It depends on 1.**

There is however one piece of item 2 worth landing **immediately**, independent of the rest: the
config validation in step 1. Right now `autoSave: true` type-checks, normalises, and does nothing —
anyone who reads `VersionsConfig` and enables it believes their content is being saved and it is
not. That is a ten-line commit and it should not wait for the feature.

### Summary

| | value | cost | risk | verdict |
| --- | --- | --- | --- | --- |
| 3 — `select` on findById | low | ~1h | none | do now, closes a stale line |
| 1 — user metas | **high** | ~1d | low | **the pick** — table columns come free |
| 2 — auto-save | **high** | ~3d + a design call | data loss | after 1; land the validation guard now |
