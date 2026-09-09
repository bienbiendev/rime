# Annex — splitting `transform`

> Stage 4.1 of `docs/decoupling.md`. **Landed.** What follows is the reasoning that produced the
> split, kept because §3 is still open work; where the shipped code differs from the plan below,
> §5 says so and the code wins.

`adapter-sqlite/transform.server.ts` turned the rows a read returns into one document. It was ~300
lines and about half of it had nothing to do with a database.

---

## 1. What is in there

Walk it top to bottom and every step falls cleanly into one of two piles.

**Database work** — needs `tables`, `getTableColumns`, the naming convention:

```ts
// resolve which tables hang off this document
const tableName = baseTableName(configCtx.shadowSlugOf(slug) ?? slug);
const blocksTables = childTableNames(tableName, 'blocks', tables);
const treeTables = childTableNames(tableName, 'tree', tables);

// merge the locales branch onto the row
if (locale && tableNameLocales in tables && doc[tableNameLocales]) {
  doc = { ...doc[tableNameLocales][0], ...doc };
  delete doc[tableNameLocales];
  delete doc.ownerId;
}

// null out localized columns a block has not saved yet — needs the column list
const localesKeys = Object.keys(getTableColumns(tables[blockLocaleTableName])).filter(
  (key) => !['id', 'locale', 'ownerId'].includes(key)
);
```

**Document work** — needs the config, the blank, the field paths, and nothing else:

```ts
// where a block goes in the document
flatDoc[`${path}.${position}`] = block;

// which bookkeeping to keep
if (!withRowMeta) {
  delete block.position;
  delete block.path;
  delete block.ownerId;
  delete block.locale;
}

// assembling a relation into a document property, with the orphan warning
flatDoc[relationPath] = [...(flatDoc[relationPath] || []), relationOutput];

// the blank merge, and the final key strip
output = omit(keysToDelete, deepmerge(blankDocument, output, { arrayMerge: (_, y) => y }));
```

The second pile is the one that keeps pulling feature-shaped decisions into the adapter. It is
where `event.params.panel` lived. It is where `blankDocument` — which is
`blankWithFeatures(definition.features, …)`, a fold over every feature — is applied.

---

## 2. The split

### 2.1 The adapter's half

One method, and it stops returning a document:

```ts
// core/adapter.ts
export interface TransformAdapter {
  /**
   * The rows one document is stored across, unflattened and grouped by what they are.
   *
   * No blank merge, no key stripping, no field paths — those are document concerns and this is
   * the only thing that needs `tables`. `contentId` is on `base` when the prototype has a shadow
   * (see `mergeContentRow`).
   */
  rows(args: { doc: RawDoc; slug: string; locale?: string }): Promise<DocumentRows>;
}

export type DocumentRows = {
  /** The document's own columns, with the locales branch already merged in. */
  base: Dic;
  /** Block rows, each carrying its own `path`, `position`, `type`, and locales merged. */
  blocks: Dic[];
  /** Tree rows, same shape. */
  tree: Dic[];
  /** Relation rows from the junction table, `relationTo`/`documentId` resolved. */
  relations: Dic[];
};
```

Everything it returns is already in core's vocabulary: rows with paths and positions. No table
names leave it.

### 2.2 Core's half

```ts
// core/pipeline/transform/index.server.ts
export const buildDocument = (
  rows: DocumentRows,
  args: {
    config: BuiltCollection | BuiltArea;
    blank: GenericDoc;
    locale?: string;
    withBlank: boolean;
    withRowMeta: boolean;
  }
): GenericDoc => {
  const flat: Dic = transformDatabaseColumnsToPaths(flatten(rows.base));

  for (const block of rows.blocks) flat[`${block.path}.${block.position}`] = shape(block, args);
  for (const node of rows.tree) flat[`${node.path}.${node.position}`] = shape(node, args);
  for (const relation of rows.relations) place(relation, flat, args);

  const output = cleanEmptyElementsInArrays(unflatten(flat));

  return args.withBlank ? deepmerge(args.blank, output, { arrayMerge: (_, y) => y }) : output;
};
```

`shape` is the `withRowMeta` strip; `place` is the relation assembly with its orphan warning.

### 2.3 The call site

`readDocument` already has everything the second half needs — it has the config, and `ctx.blank()`
is one call away:

```ts
// core/pipeline/run.server.ts — readDocument
const rows = await event.locals.rime.adapter.transform.rows({
  doc: raw,
  slug: config.slug,
  locale
});

const document = buildDocument(rows, {
  config,
  blank: blankFor(config, event),
  locale,
  withBlank: !hasSelect,
  withRowMeta: event.params.panel !== undefined
});
```

Note what disappears: the adapter no longer needs `event` at all, and no longer calls back into
`rime.collection(slug).blank()` — which is the adapter reaching _up_ into the local API, the
inversion that made this hard to see.

---

## 3. What it unlocks

### 3.1 A transform timing that has inhabitants

`versions` currently exposes `versionId` through a `beforeRead` hook:

```ts
export const exposeVersionId = Hooks.beforeRead({
  name: 'exposeVersionId',
  requires: [],
  provides: ['document'],
  run: async (args) =>
    args.doc.contentId ? { ...args, doc: { ...args.doc, versionId: args.doc.contentId } } : args
});
```

That is consistent with `setDocumentType` and `populateSizes`, which are also `beforeRead`. But it
is a _mapping_ — how a stored row becomes a document — not an enrichment of a document that
already exists.

Once `buildDocument` is a stage in core, a timing around it has real inhabitants:

```ts
// what would move into it
versions   contentId → versionId
upload     the `sizes` object, currently populateSizes in beforeRead
core       _type / _prototype, currently setDocumentType
core       locale, currently setDocumentLocale
```

Four on day one. **Do not add the timing before the split** — one inhabitant is not a seam, it is
a preference, and this repo has been bitten by building seams early.

### 3.2 `TransformAdapter` may not need to be on `Adapter` at all

`rows()` is a projection of what `find`/`findMany` already returned. It is plausible that the read
methods should return `DocumentRows` directly and the facade disappears. Worth deciding during the
split rather than before it — but if it goes, the `Adapter` interface is down to
`registerPrototype`, `prototype`, and three storage facades.

---

## 4. Gates

The transform runs on **every document of every read**, so the whole suite is the net. What
discriminates specifically:

```bash
bun run test:fields              # blocks and tree in every arrangement, incl. nested
bun run test:multilang           # the locales branch merge
bun run test:versions-multilang  # locales branch on a shadow
```

And `probing.md` §7 for `withRowMeta`, which only the panel exercises.

**The trap to expect:** `flatten`/`unflatten` are order-sensitive over keys that look numeric.
`util/object.ts:221` has a known missing backslash in `/^d+$/` (should be `/^\d+$/`) so the numeric
branch of `getValueAtPath` never fires — benign today because JS array indexing accepts string
keys, but it is exactly the kind of thing this split will surface. It is in `known-defects.md`.

---

## 5. What shipped, where it differs

`adapter-sqlite/transform.server.ts` is 169 lines; `core/pipeline/build-document.server.ts` is 129.
Three departures from §2:

**`base` comes back flat.** §2.3 had core run `transformDatabaseColumnsToPaths(flatten(rows.base))`.
That is core applying the adapter's own rule — that `__` separates path segments in a column name.
The adapter applies it and returns `base` already flat and path-keyed; core unflattens once, at the
end, after everything is placed.

**Child-table keys are stripped where they are read, not by name at the end.** The old code
flattened the whole row, so `pages__$blocks_hero` became `pages__$blocks_hero.0.id` and rode through
every step to be removed by name after the blank merge. `rows()` omits those keys before flattening,
because it has just finished reading them into their own piles.

**The locale and orphan checks run before the depth walk.** The old order fetched the related
document, then decided the row belonged to another locale and dropped it. Same output, one less
read per skipped relation.

And one thing §2.3 predicted exactly: the adapter no longer takes `event`, and no longer calls
`rime.collection(slug).blank()` or `rime.collection(…).findById()` — the two places the database
layer was reaching up into the local API.

`resolveRelationTarget` is the piece with no name in the plan. The junction table carries one
nullable foreign key column per target collection and exactly one is set; naming which is a
question about columns, so the adapter answers it and emits `relationTo`/`documentId`. A row with
no column set is an orphan, and it comes back untouched so core can name it in the warning.
