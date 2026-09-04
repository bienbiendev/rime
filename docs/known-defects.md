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

| request on a never-published document                | result |
| ---------------------------------------------------- | ------ |
| `PATCH /api/pages/<id>?draft=false`                  | 404    |
| `PATCH /api/pages/<id>?draft=true`                   | 404    |
| `PATCH /api/pages/<id>?draft=true&versionId=<vid>`   | 200    |
| same document once published, `PATCH ...?draft=true` | 200    |

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

## 2. A singleton's bootstrap writes an empty locales row

**Status:** reproduced. Cause corrected — see below; the first diagnosis here was wrong.

Bootstrapping a prototype that has at least one localized field writes a row into its
`__$$locales` table holding nothing but its own id, its `locale` and its `ownerId`:

```
infos__versions__$$locales   ('60OVf…', None, None, 'en', 'KdLDm…')   ← title and email both null
probe_area__$$locales        ('qv5un…', None, 'en', 'BFokQ…')         ← sub null
```

Harmless today — reads tolerate it — but it is a meaningless row per locale per singleton.

### Why (corrected)

I first recorded this as the two branches of `createArea` guarding differently: the versioned one
went through `insertRowWithLocales`, which checks `Object.keys(data).length`, and the
non-versioned one checked only `isLocalized`. Aligning the guards was supposed to fix it.

It does not, and the row appears on **both** paths. A bootstrap prepares its data with
`fillNotNull: true`, and `transformDataToSchema` treats a not-null column with no value by
seeding one — for `id` specifically, `result['id'] = randomId(32)`. The locales table's `id` is
`text('id').primaryKey()`, so it is not-null, so `localizedData` always contains at least that id.
The emptiness guard therefore never fires, on either branch.

The guards are aligned now anyway (`prototype.server.ts`), and the code says plainly that this
does not fix it.

### Where to fix

Judge emptiness on the values that actually came from the document, not on the seeded key —
ignore `id` in the check, or do not pass `fillNotNull` when preparing the localized half, since a
locales row with no localized values should not be written at all. Either way it wants its own
commit: it changes what is on disk, and the assertion to add is that a freshly bootstrapped
singleton with only null localized fields has zero rows in its `__$$locales` table.

---

## 3. A new draft on a collection that is both `nested` and versioned throws a SQL syntax error

**Status:** reproduced, cause identified. Pre-existing — confirmed by running the same request with
the working tree stashed, on the `versions` fixture, where `pages` is `nested: true` and
`versions: { draft: true }`.

```
PATCH /api/pages/<id>?draft=true        # the document has a published version
→ 500
DrizzleQueryError: Failed query: select "id" from "pages__versions" where  = ? order by  asc
  at childrenIds (adapter-sqlite/prototype.server.ts)
  at addChildrenProperty (core/features/nested/hooks/add-children.server.ts)
  at findById → create → handleNewVersion
```

The empty `where` and `order by` are columns that do not exist: `_parent` and `_position` are
`._root()` fields, so the schema generator puts them on the base table and **not** on the shadow —
`pages__versions` has neither. Drizzle renders the missing columns as nothing and SQLite rejects
the statement.

### Why the nested hook runs on the shadow at all

`versions/derive.server.ts` builds the shadow collection by copying the source config, including
its already-resolved pipeline:

```ts
const versionedCollection: BuiltCollection = {
  slug: withVersionsSuffix(collection.slug),
  $hooks: collection.$hooks,      // ← the parent's resolved pipeline
  fields: collection.fields,
  …
};
versionedCollection = augmentHooks({ features, hooks: collectionHooks }, versionedCollection);
```

`buildPipeline` treats a config's existing `$hooks` as the **consumer's** hooks and appends them to
what the prototype and its features contribute:

```ts
const hooks = [...own, ...fromFeatures, ...((consumer?.[timing] as unknown[]) ?? [])];
```

So the shadow runs the parent's whole pipeline on top of its own. `nested` is not set on the shadow
config — `nested.enabled(shadow)` is false, so `fromFeatures` correctly excludes
`addChildrenProperty` — but the copied `$hooks` bring it back in anyway.

### Where to fix

Do not copy `$hooks` into the derived collection; let `augmentHooks` build its pipeline from the
prototype and the features the _shadow's own_ config enables. The parent's consumer hooks are the
question to answer first: a hook an author wrote for `pages` may or may not be meant to run when a
version row of `pages` is written, and today it always does. Whatever is decided, the assertion to
add is that a nested + versioned collection can take a new draft, and that
`$pages__versions`'s pipeline does not contain `addChildrenProperty`.

Same shape as defect 1 and reachable from the same fixture, so they are worth picking up together.
