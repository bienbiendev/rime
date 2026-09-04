# Decoupling `versions` from the adapter

Cold-start handoff. Assumes no context beyond `docs/architecture-target.md`'s three layers, and
`docs/decoupling-adapter.md`'s **Vocabulary** section (base / shadow / child / branch).

`versions` is registered as a feature and behaves like a dialect: three of its concepts —
`versionId`, `draft`, `versionOperation` — are **parameters of the adapter contract**, so every
prototype and every adapter pays for them whether or not a config uses versions:

```ts
// core/adapter/types.ts — what every prototype's handle must implement
find(args?: { id?: string; versionId?: string; select?: string[]; locale?: string; draft?: boolean }): Promise<RawDoc | undefined>;
findMany(args?: { …; draft?: boolean }): Promise<RawDoc[]>;
insert(args: { data; locale? }): Promise<{ id: string; versionId: string }>;
update(args: { id?: string; versionId?: string; versionOperation: VersionOperation; data; locale? }): Promise<{ id: string }>;
```

---

## The mechanism, in code

### The shadow is a real collection

`versions`' `configure` derives one per versioned config, as a plain `BuiltCollection`:

```ts
// core/features/versions/derive.server.ts
for (const collection of config.collections || []) {
  if (collection.versions) {
    const versionedCollection: BuiltCollection = {
      slug: withVersionsSuffix(collection.slug),   // pages -> $pages__versions
      versions: undefined,                          // the shadow is not itself versioned
      fields: collection.fields,
      panel: false,
      _generateTypes: false,
      _generateSchema: false,
      …
    };
    config.collections = [...(config.collections || []), versionedCollection];
  }
}
```

and the children move with it:

```ts
// core/features/versions/naming.ts — the load-bearing line
export const contentOwnerSlug = (config: { slug: string; versions?: unknown }) =>
  (config.versions ? withVersionsSuffix(config.slug) : config.slug) as CollectionSlug;
```

Enabling versions therefore renames a whole subtree: `pages__$blocks_hero` becomes
`pages__versions__$blocks_hero`.

### Five operations, chosen above the adapter

```ts
// core/features/versions/strategy.ts
export function defineVersionUpdateOperation({ draft, versionId, config }: Args): VersionOperation {
  if (!config.versions) return VERSIONS_OPERATIONS.UPDATE; // not versioned
  if (versionId) return VERSIONS_OPERATIONS.UPDATE_VERSION; // write that version
  if (!config.versions.draft) return VERSIONS_OPERATIONS.NEW_VERSION_FROM_LATEST;
  return draft
    ? VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED
    : VERSIONS_OPERATIONS.UPDATE_PUBLISHED;
}
```

It runs as the `defineVersionOperation` hook, listed in **both** prototypes' `beforeUpdate`
(`prototype/collection/hooks.server.ts`, `prototype/area/hooks.server.ts`).

### Where the adapter branches on it

**Read** — `adapter-sqlite/prototype.server.ts`:

```ts
if (!config.versions) {
  return queryTable.findFirst({ columns, ...byId, with: buildWithParam({ table, … }) });
}

const versionsTable = baseTableName(withVersionsSuffix(slug));
const doc = await queryTable.findFirst({
  columns, ...byId,
  with: {
    [versionsTable]: {
      columns: adapterUtil.columnsParams({ table: tables[versionsTable], select }),
      with: buildWithParam({ table: versionsTable, … }),
      ...(versionId
        ? { where: eq(tables[versionsTable].id, versionId) }
        : adapterUtil.buildPublishedOrLatestVersionParams({ draft, config, table: tables[versionsTable] }))
    }
  }
});
if (!doc || !doc[versionsTable]?.length) return undefined;   // a root with no version is absent
return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable, select);
```

with the pick itself:

```ts
// adapter-sqlite/util.server.ts
export function buildPublishedOrLatestVersionParams({ draft, config, table }) {
  const hasStatus = config.versions && config.versions.draft;
  return hasStatus && !draft
    ? { where: eq(table.status, 'published'), limit: 1 }
    : { orderBy: [desc(table.updatedAt)], limit: 1 };
}
```

**Write** — same file, three branches:

```ts
if (VersionOperations.isSimpleUpdate(versionOperation)) {
  // not versioned: the root row holds everything
  await adapterUtil.updateTableRecord(db, tables, table, {
    recordId: id,
    data: { ...mainData, updatedAt: now }
  });
  return { id: data.id || id };
}

if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
  const { data: contentData, rootData } = adapterUtil.extractRootData(data);
  await adapterUtil.updateTableRecord(db, tables, baseTableName(slug), {
    recordId: id,
    data: { updatedAt: now, ...rootData }
  });

  // publishing demotes this document's other versions first
  if (config.versions?.draft && mainData.status === VERSIONS_STATUS.PUBLISHED) {
    await db
      .update(tables[versionsTable])
      .set({ status: VERSIONS_STATUS.DRAFT })
      .where(eq(tables[versionsTable].ownerId, id));
  }
  await adapterUtil.updateTableRecord(db, tables, versionsTable, {
    recordId: versionId,
    data: { ...mainData, updatedAt: now }
  });
  return { id: data.id || id };
}

if (VersionOperations.isNewVersionCreation(versionOperation)) {
  // the version row already exists — only the root is touched here
  const { rootData } = adapterUtil.extractRootData(data);
  await adapterUtil.updateTableRecord(db, tables, baseTableName(slug), {
    recordId: id,
    data: { updatedAt: now, ...rootData }
  });
  return { id: data.id || id };
}
```

That third branch is the proof the strategy can live above the adapter — the version row was
already made by the feature, through the public API:

```ts
// core/features/versions/hooks/handle-new-version.server.ts
case VersionOperations.isNewVersionCreation(versionOperation): {
  const versionsSlug = withVersionsSuffix(config.slug);
  const document = await rime.collection(versionsSlug).create({ data, locale: params.locale });
  if (config.versions?.maxVersions) {
    await rime.collection(versionsSlug).delete({
      sort: '-updatedAt',
      query: 'where[status][not_equals]=published',
      offset: config.versions.maxVersions
    });
  }
  versionId = document.id;
  break;
}
```

**Schema** — `adapter-sqlite/generate-schema/index.server.ts` builds the shadow because
`collection.versions` is truthy:

```ts
if (collection.versions) {
  const rootFieldsFromConfig = [...collection.fields].filter((f) => f.get.root);
  await buildRootTable({ fields: [...rootFieldsFromConfig, date('createdAt'), date('updatedAt')], … });

  rootTableName = baseTableName(withVersionsSuffix(collectionSlug));   // everything below is now the shadow's
  const manyVersionsToOneName = `rel_${rootTableName}HasOne${toPascalCase(collectionSlug)}`;
  …
}
```

---

## The observation the plan rests on

`context.params.versionId` **is** the shadow row's id — and when there is no shadow row it falls
back to the document's own. All three branches:

```ts
// core/features/versions/hooks/handle-new-version.server.ts
switch (true) {
  case VersionOperations.isSpecificVersionUpdate(versionOperation):
    versionId = originalDoc.versionId; // the version that was read, written in place
    break;

  case VersionOperations.isNewVersionCreation(versionOperation): {
    const document = await rime
      .collection(withVersionsSuffix(config.slug))
      .create({ data, locale: params.locale });
    versionId = document.id; // the shadow row just created
    break;
  }

  default:
    versionId = originalDoc.id; // UPDATE — not versioned, so the root row
}
```

`originalDoc.versionId` in the first branch is put there by the read, which merges the root row
with the chosen shadow row:

```ts
// adapter-sqlite/util.server.ts — mergeRawDocumentWithVersion
return {
  ...omit([versionTableName], doc),
  ...omit(['id', 'ownerId', 'createdAt', 'updatedAt'], versionData),
  versionId: versionData.id // the document keeps the root id; the shadow row id rides along
} as RawDoc;
```

So the value is precisely: **the id of the row this document's content lives on** — the shadow row
when versioned, the root row when not. Which is exactly what the pipeline then uses it for:

```ts
// core/pipeline/run.server.ts
await persistRelational({
  context,
  ownerId: context.params.versionId!, // blocks, tree and relations hang off this
  data,
  incomingPaths,
  adapter,
  config,
  locale: args.locale
});
```

```ts
// adapter-sqlite/prototype.server.ts — insertPrototype's own comment
/** For a non-versioned prototype `versionId` comes back equal to `id`. */
```

The name is right inside the feature and wrong outside it. `core/pipeline/` and
`core/adapter/types.ts` do not have a versions concept in them — they have a **content owner**
concept, and `versions` is the feature that changes which row that is. That is what Stage 1 renames,
and it is a rename only: the same value, called what it is at each layer.

## What decoupled looks like

```ts
// core/adapter/types.ts — after
find(args?: { id?: string; contentId?: string; select?: string[]; locale?: string }): Promise<RawDoc | undefined>;
insert(args: { data; locale? }): Promise<{ id: string; contentId: string }>;
update(args: { id?: string; contentId?: string; data; locale? }): Promise<{ id: string }>;
```

`contentId` defaults to the root row, so a prototype with no shadow never sets it and its adapter
path is the `isSimpleUpdate` branch with no branch left in it.

Two things do **not** decouple by renaming — picking the content row on a read, and generating the
shadow table — and both point at the shadow becoming a **registration-time declaration**:

```ts
// what the feature would declare
shadow: (config) => ({
  slug: withVersionsSuffix(config.slug), // where the content rows live
  ownerColumn: 'ownerId', // how they point back at the root
  pick: config.versions.draft ? { column: 'status', equals: 'published', else: 'newest' } : 'newest'
});

// what the adapter is told, once, at boot — beside `singleton`, which it already takes
adapter.registerPrototype({ config, singleton, shadow });
```

```ts
// and what the read becomes: no config.versions, no draft, no withVersionsSuffix
const shadow = handle.shadow;
if (!shadow) return queryTable.findFirst({ columns, ...byId, with: … });

const doc = await queryTable.findFirst({
  columns, ...byId,
  with: { [baseTableName(shadow.slug)]: { columns, with: …, ...pickParams(shadow.pick, contentId, table) } }
});
```

`pick` is the part to be careful with: it is one step from inventing a query language in the
adapter contract. If it grows past "a column equals a value, else newest", stop — resolving the id
above the adapter and paying a second query per read is the better trade.

---

## The plan, in stages

Each is shippable and gate-able on its own. Stages 0 and 1 have no design questions left in them.

### Stage 0 — `_root` fields stop being a hardcoded list

The two halves of the repo already disagree about what a root field is. Schema generation reads a
flag:

```ts
// adapter-sqlite/generate-schema/index.server.ts
const rootFieldsFromConfig = [...collection.fields].filter((f) => f.get.root);
```

The write path matches names:

```ts
// adapter-sqlite/util.server.ts
export function extractRootData(data: any) {
  const rootData: { _parent?: string; _position?: number; _path?: string } = {};
  if ('_parent' in data) {
    rootData._parent = data._parent;
    delete data._parent;
  }
  if ('_position' in data) {
    rootData._position = data._position;
    delete data._position;
  }
  if ('_path' in data) {
    rootData._path = data._path;
    delete data._path;
  }
  return { data, rootData };
}
```

Those three names are two features' fields, hardcoded in the adapter — and they already carry the
flag:

```ts
// core/features/nested/module.ts
(text('_parent').hidden()._root(), number('_position').defaultValue(0).hidden()._root());

// core/features/upload/module.ts
const _pathField = text('_path')._root().hidden().validate(validatePath);
```

So a field marked `._root()` by anything else gets a root **column** and has its **value** written
to the version row. Take the list from the config:

```ts
export function extractRootData(data: Dic, config: BuiltCollection | BuiltArea) {
  const rootPaths = config.fields
    .filter(isFormField)
    .filter((f) => f.get.root)
    .map((f) => f.name);
  const rootData: Dic = {};
  for (const path of rootPaths) {
    if (path in data) {
      rootData[path] = data[path];
      delete data[path];
    }
  }
  return { data, rootData };
}
```

No contract change, two feature names out of the adapter, and it exercises the fixtures and gates
below before anything risky. **Do this first.**

### Stage 1 — `versionId` → `contentOwnerId`, no behaviour change

```diff
  // core/pipeline/run.server.ts
  assertUpsertContext(context, where, [
-   'configMap', 'originalConfigMap', 'originalDoc', 'versionOperation', 'versionId'
+   'configMap', 'originalConfigMap', 'originalDoc', 'versionOperation', 'contentOwnerId'
  ]);

  await persistRelational({
-   ownerId: context.params.versionId!,
+   ownerId: context.params.contentOwnerId!,
    …
  });
```

```diff
  // core/adapter/types.ts
- insert(args: { data; locale? }): Promise<{ id: string; versionId: string }>;
+ insert(args: { data; locale? }): Promise<{ id: string; contentId: string }>;
```

Leave `features/versions/` speaking of versions — inside the feature the name is right:

```ts
// core/features/versions/hooks/handle-new-version.server.ts — after
const version = await rime.collection(versionsSlug).create({ data, locale: params.locale });
return { ...args, context: { ...args.context, params: { ...params, contentOwnerId: version.id } } };
```

Mechanical, and doing it alone is the point: the diff shows which remaining references are
genuinely about versions.

### Stage 2 — the shadow is registered, not inferred

```ts
// core/features/define.ts
/** A table this feature deviates a prototype's rows into. Read at registerPrototype time. */
shadow?: (config: any) => ShadowDeclaration | undefined;
```

```ts
// core/boot.server.ts — where prototypes already register
for (const prototype of prototypes) {
  for (const prototypeConfig of configCtx.byPrototype(prototype.name)) {
    adapter.registerPrototype({
      config: prototypeConfig,
      singleton: prototype.singleton,
      shadow: shadowFor(prototype, prototypeConfig) // first feature declaring one wins
    });
  }
}
```

`generate-schema` then builds tables from registered shadows rather than from `config.versions`,
and `type: 'shadow'` on the feature finally means something. **This is the stage that touches the
generated schema** — capture a golden one on `versions` and `versions-multilang` first.

### Stage 3 — the read selector

`find`/`findMany` lose `draft` and `versionId`; `buildPublishedOrLatestVersionParams` becomes a
function of the declaration rather than of `config.versions`:

```ts
const pickParams = (pick: Pick, contentId: string | undefined, table: GenericTable) =>
  contentId
    ? { where: eq(table.id, contentId), limit: 1 }
    : pick === 'newest'
      ? { orderBy: [desc(table.updatedAt)], limit: 1 }
      : { where: eq(table[pick.column], pick.equals), limit: 1 };
```

### Stage 4 — the write plan

`versionOperation` leaves the contract, and `updatePrototype` collapses:

```ts
export const updatePrototype = async ({ db, tables }, { slug, id, contentId, data, locale, config }) => {
  const { data: contentData, rootData } = adapterUtil.extractRootData(data, config);
  const now = new Date();

  // the root row always: its own fields, plus everything else when there is no content row
  await adapterUtil.updateTableRecord(db, tables, baseTableName(slug), {
    recordId: id,
    data: { updatedAt: now, ...rootData, ...(contentId ? {} : contentData) }
  });

  // and the content row when one was named
  if (contentId) { … write contentData into the shadow, by contentId … }

  return { id: data.id || id };
};
```

The publish demotion moves above the adapter, into the versions feature, where two of the five
operations already are.

### Stage 5 — the remainder

`core/constants.ts` (`VERSIONS_STATUS`), `core/pipeline/types.ts` importing `VersionOperation`,
`core/dev/codegen/routes/common.server.ts`'s versions pages, and
`core/pipeline/persist/{blocks,relations,tree}` importing `contentOwnerSlug`. Most fall out of
Stages 2–4; whatever is left is the honest remainder and belongs in the audit rather than being
forced.

---

## Traps

- **The hooks cannot be gated by `enabled`.** `defineVersionOperation` populates what
  `assertUpsertContext` requires on _every_ update, so both prototypes list versions'
  `beforeUpdate` hooks directly and gating them breaks updates on non-versioned configs. Stage 1 is
  what makes this fixable: once the context carries a content owner rather than a version
  operation, a non-versioned config needs nothing from the feature. Do not attempt the listing
  before Stage 1.
- **A feature must not import a prototype definition.** `derive.server.ts` needs the collection
  prototype's `features` and takes them from the registry `configure` is handed:

  ```ts
  export function makeVersionsCollectionsAliases<C extends Config>(config: C, prototypes: RegisteredPrototype[] = []) {
    const features = prototypes.find((p) => p.name === 'collection')?.features || [];
    …
    versionedCollection = augmentHooks({ features, hooks: collectionHooks }, versionedCollection);
  }
  ```

  Importing the definition instead can be evaluated _from within_ it and find the feature still in
  flight — `undefined`, silently. `prototype/collection/config/pipeline.spec.ts` fails when it
  happens.

- **The shadow runs the collection pipeline.** It is a collection, so anything added to the
  collection prototype's hooks runs for `$pages__versions` too. Intended, and why `derive.server.ts`
  calls `augmentHooks`.
- **`$` and `__` are load-bearing in slug space.** `$` marks rime-derived, `__` marks _shadow of_
  and survives case conversion as a segment boundary; `config/validate.server.ts` rejects an author
  slug containing `__` for that reason. Do not invent a third marker.

---

## Gates

Standing gates are in `docs/restructure-handoff.md`. Specific to this work:

```bash
bun run rime:use versions              # and versions-multilang for anything touching locales
bun run check && bunx eslint src/lib && bunx vitest run && bun run check:circular-deps
```

- **Re-measure every baseline after switching fixture.** The counts differ per fixture; comparing
  across two reads as a regression that is not there.
- **Golden schema, per fixture.** Stage 2 onwards changes how the shadow is generated:

  ```bash
  cp src/lib/+rime.generated/schema.server.ts /tmp/schema.versions.before.ts
  # … change, boot again …
  diff /tmp/schema.versions.before.ts src/lib/+rime.generated/schema.server.ts
  ```

  A shadow that silently stops being generated shows up here and nowhere else.

- **`prototype/collection/config/pipeline.spec.ts`** must stay green — it catches a derived
  collection losing its hooks.

### Probes, and what each discriminates

```bash
curl -c c.txt -X POST localhost:5173/api/init -H 'content-type: application/json' \
  -d '{"email":"admin@test.com","name":"Admin","password":"Str0ngPass!word"}'
curl -c c.txt -b c.txt -X POST localhost:5173/api/auth/sign-in/email -H 'content-type: application/json' \
  -d '{"email":"admin@test.com","password":"Str0ngPass!word"}'
```

| probe                                              | what breaks it                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `POST` a versioned doc, then `GET` it              | the shadow join, `insert` returning both ids                                           |
| `PATCH` it, then `GET`                             | `contentId` threading — a wrong owner writes children onto the root                    |
| publish, add a draft, `GET` without `?draft=true`  | the published-or-latest pick                                                           |
| publish the second draft, list `$slug__versions`   | the demotion — exactly one published at a time                                         |
| a versioned **area** holding only a draft          | must 404, not return the empty root row                                                |
| a doc with blocks or a relation, updated **twice** | children written against the wrong owner survive one write and duplicate on the second |

The last one is the reason to care: an owner-id mistake is invisible on a single write.

---

## Decisions to make before Stage 2

1. **Does `pick` live in the declaration, or does the feature resolve the content id first?** The
   declaration keeps reads at one query and puts a small predicate in the contract; resolving first
   keeps the contract clean and costs a query per read. Measure the read path before choosing.
2. **Does `insert` still write the first content row?** It is the one place the adapter creates a
   shadow row on its own. The alternative — the feature creating it through the public API, as
   `handleNewVersion` already does — is more consistent and costs a round trip on every create.
3. **Is `status` the adapter's business at all?** It is a normal field on the shadow collection,
   added by versions' augment. Only the demotion and the published-or-latest pick read it, and both
   are candidates to move above the adapter.
