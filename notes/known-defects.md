# Known defects

Behaviours that are wrong, or look wrong, and were left alone rather than fixed inside an
unrelated commit. Each is reproduced and traced to the line responsible.

---

## 1. A never-published document cannot be PATCHed without a `versionId`

**Status:** reproduced. Pre-existing.

On a collection with `versions: { draft: true }`, a document created but never published:

```
PATCH /api/pages/<id>?draft=false                 404
PATCH /api/pages/<id>?draft=true                  404
PATCH /api/pages/<id>?draft=true&versionId=<vid>  200
same document once published, ?draft=true         200
```

The trigger is "has no published version", not the draft flag.

### Why

`defineVersionUpdateOperation` — `core/prototype/shared/versions/strategy.ts` — picks the
operation from `{ draft, versionId, config }`. With no `versionId` on a draft-enabled collection
it answers `NEW_DRAFT_FROM_PUBLISHED` when `draft` is true and `UPDATE_PUBLISHED` when it is
false.

`VersionOperations.shouldRetrieveDraft` is true for two operations, and neither is one of those:

```ts
operation === VERSIONS_OPERATIONS.UPDATE_VERSION ||
  operation === VERSIONS_OPERATIONS.NEW_VERSION_FROM_LATEST;
```

`getOriginalDocument` — `core/pipeline/hooks/get-original-document.server.ts` — passes that as its
`draft` argument, so it reads the original with a published-only filter. There is no published
version, `findById` throws `NOT_FOUND`, and the request 404s in step 3 of `runUpdate` before the
write. Nothing is persisted.

### Is it wrong

`NEW_DRAFT_FROM_PUBLISHED` means "fork a new draft from the published version", and there isn't
one — so refusing is defensible. Two things are wrong regardless:

- **The error is a lie.** `not_found` says the document does not exist. It does; it has no
  published version, and nothing reading the status code can tell those apart.
- **`UPDATE_PUBLISHED` is chosen for `draft=false`**, which on a never-published document is not a
  meaningful operation either.

The panel never hits this — it always sends a `versionId`. It is reachable from the REST API.

### Where to fix

Widen `shouldRetrieveDraft` so these two read the latest version rather than the published one, or
have `defineVersionUpdateOperation` fall back to a `NEW_VERSION_FROM_LATEST`-shaped operation when
no published version exists. The second needs a read to decide, so the first is cheaper. Either
way the failure when it genuinely cannot proceed should not be `NOT_FOUND`.

---

## 2. A singleton's bootstrap writes an empty locales row

**Status:** reproduced.

Bootstrapping a prototype with at least one localized field writes a row holding nothing but its
own id, its locale and its owner:

```
infos__versions__$$locales   ('60OVf…', None, None, 'en', 'KdLDm…')   title and email both null
probe_area__$$locales        ('qv5un…', None, 'en', 'BFokQ…')         sub null
```

Harmless — reads tolerate it — but it is a meaningless row per locale per singleton.

### Why

`ensurePrototypeExists` prepares its data with `fillNotNull: true`, and `transformDataToSchema`
seeds a not-null column that has no value:

```ts
result['id'] = randomId(32);
```

The locales table's `id` is `text('id').primaryKey()`, so it is not-null, so `localizedData`
always carries at least that id. The emptiness guard therefore never fires:

```ts
// adapter-sqlite/write.server.ts
if (isLocalized && Object.keys(localizedData).length) { … }
```

### Where to fix

Judge emptiness on the values that came from the document, not on the seeded key — ignore `id` in
the check, or do not pass `fillNotNull` when preparing the localized half. A locales row with no
localized values should not be written at all.

It wants its own commit: it changes what is on disk. The assertion to add is that a freshly
bootstrapped singleton with only null localized fields has zero rows in its `__$$locales` table.

---

## 3. An upload collection with image sizes loses its non-leaf fields from the generated type

**Status:** identified, no fixture reaches it.

`core/prototype/collection/upload/doc-type.ts`:

```ts
fields: (field) => field instanceof FormFieldBuilder && !sizes.some((s) => s.name === field.name);
```

The second clause is the intended one — a per-size column already has a type through the `sizes`
member, so it must not appear twice. The first clause drops **every non-leaf field** — blocks,
tabs, groups, tree, relations — from the generated document type.

The filter only applies when there are sizes, so `upload: true` on its own behaves differently for
no stated reason.

### Why no fixture catches it

Every upload collection in `tests/` is flat: `medias` is `alt` plus its sizes. A collection with
both `imageSizes` and a `blocks` field would generate a `MediasDoc` missing the blocks member, and
nothing would fail — the doc types end in `[x: string]: unknown`, so reading the absent property
still compiles.

### Where to fix

Drop the `field instanceof FormFieldBuilder` clause. The gate is a fixture: an upload collection
with `imageSizes` **and** a blocks field, asserting the block type appears in
`app.generated.d.ts`.

## 4. A relation field with $root() doesn't declare a relation in the generated schema

**Status:** fixed — a config error.

`$root()` is defined on `FormFieldBuilder`, so a relation accepts it. A relation is stored as
rows of `<table>__$rels`, and only the content table gets that junction: the base table's
`buildRootTable` call discards the `relationFieldsMap` it returns. So
`relation('x').to('y').$root()` used to type-check, generate no junction for the base row, and
store nothing.

### The fix

`validateRelationField` refuses `$root()` on a relation. A reference that has to sit on the base
row is a text column with `$references(slug, { resolve: true })`: the adapter joins the target on
read and the document carries it on the same key, `{ id, name, email }` for `staff`; a write takes
that object or the id. `createdBy` is one.
