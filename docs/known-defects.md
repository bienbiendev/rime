# Known defects

Behaviours found while working on the adapter that are wrong, or look wrong, and were left
alone rather than fixed inside an unrelated commit. Each one is reproduced and traced to the
line responsible, so picking one up does not mean re-doing the diagnosis.

---

## 1. A versioned document that has never been published cannot be PATCHed without a `versionId`

**Status:** reproduced, cause identified. Pre-existing — not introduced by the adapter work.

On a collection with `versions: { draft: true }`, a document created but never published
returns `404 not_found` on `PATCH /api/<slug>/<id>`, whatever the `draft` query parameter says.
Passing an explicit `versionId` works, and once the document has a published version the
plain PATCH works too:

| request on a never-published document | result |
| --- | --- |
| `PATCH /api/pages/<id>?draft=false` | 404 |
| `PATCH /api/pages/<id>?draft=true` | 404 |
| `PATCH /api/pages/<id>?draft=true&versionId=<vid>` | 200 |
| same document once published, `PATCH ...?draft=true` | 200 |

So the trigger is **"has no published version"**, not the draft flag.

### Why

`defineVersionUpdateOperation` (`core/features/versions/strategy.ts`) picks the operation from
`{ draft, versionId, config }`. With no `versionId` on a draft-enabled collection it returns
`NEW_DRAFT_FROM_PUBLISHED` when `draft` is true and `UPDATE_PUBLISHED` when it is false.

`VersionOperations.shouldRetrieveDraft` returns true for `UPDATE_VERSION` and
`NEW_VERSION_FROM_LATEST` only — so for **both** of the operations above it is false.

`getOriginalDocument` (`core/operations/steps/get-original-document.server.ts:24`) uses that
value as its `draft` argument, so it reads the original with a published-only filter. There is
no published version, `findById` throws `NOT_FOUND`, and the request 404s in step 3 of
`runUpdate` — before the write. Nothing is persisted; the document is unchanged.

### Is it wrong?

Partly defensible: `NEW_DRAFT_FROM_PUBLISHED` means "fork a new draft from the published
version", and there isn't one. But two things are wrong regardless:

- **The error is a lie.** `not_found` says the document does not exist. It does; it merely has
  no published version. Anything reading the status code cannot tell those apart.
- **`UPDATE_PUBLISHED` is chosen for `draft=false`**, which for a never-published document is
  not a meaningful operation either — the same 404 for a different reason.

The panel does not hit this because it always sends a `versionId`. It is reachable from the
REST API, which is how it was found.

### Where to fix

Either widen `shouldRetrieveDraft` so these two operations read the latest version rather than
the published one, or have `defineVersionUpdateOperation` fall back to a
`NEW_VERSION_FROM_LATEST`-shaped operation when no published version exists. The second needs a
read to decide, so the first is likely cheaper. Whichever, the failure when it genuinely cannot
proceed should not be `NOT_FOUND`.

---

## 2. An area's non-versioned bootstrap writes an empty locales row

**Status:** reproduced. Small.

`createArea` (`adapter-sqlite/area.server.ts`) has two branches. The versioned one delegates to
`insertRowWithLocales`; the non-versioned one still writes its own rows, and the two guard the
locales insert differently:

```ts
// insertRowWithLocales — skips a locales row that would carry nothing
if (isLocalized && Object.keys(data).length) { … }

// createArea, non-versioned branch — writes it regardless
if (isLocalized) { … }
```

For an area with at least one localized field and no values supplied — which is exactly the
bootstrap case, since it inserts a blank document — the second writes a row holding nothing but
its own id, its `locale` and its `ownerId`. Confirmed against the database with a non-versioned
probe area:

```
probe_area                 ('BFokQ…', None, None, 1788293040211, 1788293040211)
probe_area__$$locales      ('qv5un…', None, 'en', 'BFokQ…')   ← sub is null; the row says nothing
```

Harmless today — reads tolerate it — but it is a row per locale per area that means nothing,
and the two branches disagreeing is what makes it easy to miss.

### Correction to an earlier claim

I previously said this branch **also** writes no `createdAt`/`updatedAt`. That was wrong, and
the run above is what showed it: both columns are populated. They do not come from the write —
`insertTableRecord` adds nothing and the non-versioned branch passes no timestamps — they come
from the blank document. `augmentMetas` (`core/factory/shared/augment-metas.ts`) adds
`date('createdAt')` and `date('updatedAt')` to every prototype, and `DateFieldBuilder`'s
constructor sets `defaultValue = () => new Date()`, so `createBlankDocument` already carries
real dates and `prepareSchemaData` passes them through.

Worth knowing because the value is the moment the *blank document* was built rather than the
moment of the insert. For a bootstrap those are microseconds apart, so it is not a bug — but it
is not the write maintaining them either, and anything that later stops going through
`createBlankDocument` would silently lose them.

### Where to fix

Adding `&& Object.keys(localizedData).length` to the guard matches `insertRowWithLocales` and is
the whole change. The larger version is to fold this branch into `insertRowWithLocales`
outright, which is what it was extracted for; it was left out at the time precisely because
doing so would have changed this behaviour inside a commit that claimed to change nothing.
That belongs with the move of `createArea` to a boot-time `definePrototype()`
(`adapter-sqlite/area.server.ts`, the `@TODO` on the read path).
