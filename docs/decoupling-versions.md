# Decoupling `versions` from the adapter

Cold-start handoff. Assumes no context beyond `docs/architecture-target.md`'s three layers, and
`docs/decoupling-adapter.md`'s **Vocabulary** section (base / shadow / child / branch).

`versions` is registered as a feature and behaves like a dialect: three of its concepts —
`versionId`, `draft`, `versionOperation` — are **parameters of the adapter contract**, so every
prototype and every adapter pays for them whether or not a config uses versions:

```ts
// core/adapter.ts — what every prototype's handle must implement
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
`core/adapter.ts` do not have a versions concept in them — they have a **content owner**
concept, and `versions` is the feature that changes which row that is. That is what Stage 1 renames,
and it is a rename only: the same value, called what it is at each layer.

## What decoupled looks like

```ts
// core/adapter.ts — after
find(args?: { id?: string; contentId?: string; select?: string[]; locale?: string }): Promise<RawDoc | undefined>;
insert(args: { data; locale? }): Promise<{ id: string; contentId: string }>;
update(args: { id?: string; contentId?: string; data; locale? }): Promise<{ id: string }>;
```

`contentId` defaults to the root row, so a prototype with no shadow never sets it and its adapter
path is the `isSimpleUpdate` branch with no branch left in it.

One thing does **not** decouple by renaming — generating the shadow table — and it points at the
shadow becoming a **registration-time declaration**:

```ts
// what the feature declares: where the content rows live, and nothing about which one to read
shadow: (config) => ({ slug: withVersionsSuffix(config.slug) });

// what the adapter is told, once, at boot — beside `singleton`, which it already takes
adapter.registerPrototype({ config, singleton, shadow });
```

That is the whole declaration, and the line it draws is **structure, not policy**. Where the rows
live is a fact about storage: the schema generator cannot generate a table it has not been told
about, and the read cannot join a table it cannot name. _Which_ of those rows a given request
means is a decision, it belongs to whoever makes it, and the adapter is not that.

The first attempt at stage 3 put the decision in the declaration anyway:

```ts
// what was built, and reverted in 29192dae
pick: config.versions?.draft ? { column: 'status', equals: VERSIONS_STATUS.PUBLISHED } : 'newest';
```

An earlier draft of this document warned about exactly that — "`pick` is the part to be careful
with: it is one step from inventing a query language in the adapter contract" — and the commit
shipped it while quoting the warning. The tell that it was wrong is in the contract it produced:
`pick` needed a companion per-request `latest` flag to be usable at all, because half the callers
wanted the row the declaration selected and half wanted the newest one regardless. **A declaration
that needs a runtime flag beside it is a declaration in the wrong place.** The caller already knows
which row it wants; it should name it rather than describe a policy for the adapter to re-evaluate.

So the adapter takes an id and no policy:

```ts
// core/adapter.ts — after
find(args?: { id?: string; contentId?: string; select?: string[]; locale?: string });
```

```ts
// and what the read becomes: no config.versions, no draft, no pick, no withVersionsSuffix
const shadow = handle.shadow;
if (!shadow) return queryTable.findFirst({ columns, ...byId, with: … });

const contentTable = baseTableName(shadow.slug);
const content = contentId
  ? { where: eq(tables[contentTable].id, contentId) }
  : { orderBy: [desc(tables[contentTable].updatedAt)] }; // the row a bare read means

return queryTable.findFirst({
  columns, ...byId,
  with: { [contentTable]: { columns, with: …, ...content, limit: 1 } }
});
```

The `orderBy` fallback is not the `'newest'` half of `pick` returning by the back door. It is what
"the content of this document" means when nobody said otherwise — the same statement as `updatedAt`
being the default sort, and it names no feature, no column of one, and no magic value. A caller
that wants a _rule_ applied resolves the row first and passes `contentId`.

---

## The plan, in stages

Each is shippable and gate-able on its own. Stages 0 and 1 have no design questions left in them.

### Stage 0 — `_root` stops being a hardcoded list

**What `_root` means:** _this field lives on the base row, not the shadow row_. It says nothing on
its own — a prototype with no shadow puts everything on the base table — so the flag is read only
where a shadow exists. The schema split is exactly symmetric:

```ts
// adapter-sqlite/generate-schema/index.server.ts
if (collection.versions) {
  // the base table gets the _root fields …
  const rootFieldsFromConfig = [...collection.fields].filter((f) => f.get.root);
  await buildRootTable({ fields: [...rootFieldsFromConfig, date('createdAt'), date('updatedAt')], … });
  rootTableName = baseTableName(withVersionsSuffix(collectionSlug));
}

// … and the shadow gets everything else
await buildRootTable({
  fields: collection.versions ? collection.fields.filter((f) => !f.get.root) : collection.fields,
  rootName: rootTableName,
  …
});
```

Which is why hierarchy and upload paths are marked with it — a site tree that forked per revision
would be nonsense:

```ts
// core/features/nested/module.ts
fields: [text('_parent').hidden()._root(), number('_position').defaultValue(0).hidden()._root()];

// core/features/upload/module.ts
const _pathField = text('_path')._root().hidden().validate(validatePath);
```

**The write path does not read the flag.** It matches those three names:

```ts
// adapter-sqlite/util.server.ts — called from the two versioned update branches and from insert
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

So a field marked `._root()` by anything other than nested or upload is **silently dropped on a
versioned write**: it has a base column and no shadow column, its value stays in the content half,
and `prepareSchemaData` keeps only the columns the shadow table actually has —

```ts
const columns = getTableColumns(tables[mainTableName]);
return { mainData: transformDataToSchema(data, columns, { fillNotNull }), … };
```

— so the value goes nowhere, with no error. Take the list from the config instead:

```ts
export function extractRootData(data: Dic, config: BuiltCollection | BuiltArea) {
  const basePaths = config.fields
    .filter(isFormField)
    .filter((f) => f.get.root)
    .map((f) => f.name);
  const rootData: Dic = {};
  for (const path of basePaths) {
    if (path in data) {
      rootData[path] = data[path];
      delete data[path];
    }
  }
  return { data, rootData };
}
```

No contract change, two feature names out of the adapter, one latent bug closed — and it exercises
the fixtures and gates below before anything risky. **Do this first.** _(Done: the read side had
the same list, missing `_path`, so a `select=_path` on a versioned upload collection dropped it.)_

Two things to notice while in there, both fair game for the same commit:

- **Areas never filter.** `generate-schema` carries `// For now, areas don't need to filter out
fields with or without _root`, so a versioned area puts every field on the shadow. Harmless today
  — `nested` and `upload` are collection-only — and wrong the moment anything marks a field on an
  area.
- **The name predates the vocabulary.** `docs/decoupling-adapter.md` says base / shadow / child /
  branch; this flag says `root`. `._base()` would say what it means. A rename touches three feature
  files, the builder, and the schema generator, and is worth doing only if it happens alongside
  something else in those files.

### Stage 1 — `versionId` → `contentOwnerId`, no behaviour change ✅ done

What it turned out to be, once written: `versionId` was carrying **two** meanings on one field.
`context.params.versionId` was the version the caller asked for, and `handleNewVersion` then
_overwrote_ it with the row the content had to go on. The area's update said so in a comment:

```ts
// Deliberately the versionId this call was made with, not the one the hooks resolved onto
// the context — preserved from the pre-refactor implementation.
```

So the split is the fix, not the rename:

```ts
context.params.versionId; // what the caller asked for — never written to
context.contentOwnerId; // the row the content lives on — what handleNewVersion answers
```

```ts
// core/features/versions/hooks/handle-new-version.server.ts — returns a context, not a param
return { ...args, context: { ...args.context, contentOwnerId } };

// core/pipeline/run.server.ts
assertUpsertContext(context, where, ['configMap', 'originalConfigMap', 'originalDoc', 'versionOperation', 'contentOwnerId']);
await persistRelational({ context, ownerId: context.contentOwnerId!, … });

// core/adapter.ts
insert(args: { data; locale? }): Promise<{ id: string; contentId: string }>;
```

`versionId` in `core/pipeline` and `core/adapter` went 11 → 7, and every survivor is a real version
id: the two reads in `get-original-document`, `params.versionId` itself, and `find`/`update`'s
parameters, which are stages 3 and 4.

### Stage 2 — the shadow is declared, not inferred ✅ done

**Schema half: done.** A feature says what it deviates a config's content into, and the schema
generator builds the second table from that rather than from a member it recognises by name:

```ts
// core/features/define.ts
export type ShadowDeclaration = {
  /** The shadow's own slug — `$pages__versions`. Slug space; the adapter maps. */
  slug: string;
};

/** The table this feature deviates a config's content into, or `undefined`. */
shadow?: (config: any) => ShadowDeclaration | undefined;
```

```ts
// core/features/versions/index.ts
shadow: (config) => ({ slug: withVersionsSuffix(config.slug) }),
```

```ts
// core/features/registry.ts — first feature answering wins, in the prototype's declared order
export const shadowOf = (features: FeatureDefinition[], config: Dic) =>
  features.reduce<ShadowDeclaration | undefined>(
    (found, feature) => found ?? (feature.enabled(config) ? feature.shadow?.(config) : undefined),
    undefined
  );
```

```ts
// adapter-sqlite/generate-schema/index.server.ts
const shadow = shadowOf(entry.prototype.features, prototype);

if (shadow) {
  // base row: identity, timestamps, the `._root()` fields
  rootTableName = baseTableName(shadow.slug); // everything else, and every child, moves here
}
```

`prototypeEntries` in `core/prototype/registry.ts` is what makes that possible: the same fold as
`prototypeConfigs`, but each config still paired with the definition that owns it, so the features
extending it are reachable without asking the config what kind it is. `root.server.ts`'s
`versionsFrom` is now `shadows` — named after the relationship, not after the feature that asks
for one. The generator no longer imports `versions/naming.js`.

**`ShadowDeclaration` is one member on purpose.** `ownerColumn` and `pick` are what the runtime
half and Stage 3 need; declaring them now would repeat exactly the mistake this stage fixes —
`type: 'shadow'` sat there for three commits with nothing reading it. Add each when its reader
exists.

**Runtime half: done.** `registerPrototype` takes the declaration and the handle carries it, so
every operation resolves the second table from `shadow.slug` instead of appending a suffix to the
config's own. `prototype.server.ts` no longer imports `versions/naming.js`, and the five
`if (config.versions)` branches that meant "is there a second table" are `if (shadow)`.

What stays is deliberate, and is stages 3–5: `config.versions.draft` still decides what a version
row _means_ — the published-or-latest selector, the demotion on publish, the first version's
status. `ShadowDeclaration` gains `pick` and `ownerColumn` when those readers exist, not before.

The boot order is why it was a separate step from the schema half:

```
3. bootFeatures → 4. codegen/generateSchema → 5. createAdapter → 6. registerPrototype
```

Schema generation runs two steps _before_ registration exists, so the declaration has two
consumers, not one. The generator folds it per config; registration will carry it per prototype:

```ts
// core/boot.server.ts — step 6
adapter.registerPrototype({
  config: prototypeConfig,
  singleton: prototype.singleton,
  shadow: shadowOf(prototype.features, prototypeConfig)
});
```

### Stage 3 — the operation resolves its own content row

`find`/`findMany` lose `draft` and `versionId` and gain `contentId`. Nothing replaces them inside
the adapter: whoever wanted a rule applies it above, and hands down an id.

**The primitive already exists.** A shadow is a registered prototype in its own right —
`$news__versions` is a collection with a handle, a config and a pipeline, which is how
`handle-new-version.server.ts` already writes version rows through the public API. So resolving a
content row needs no new adapter surface at all:

```ts
// core/features/versions/… — a beforeRead hook, or the operation itself
const [version] = await rime.collection(contentOwnerSlug(config)).find({
  query: draft
    ? `where[ownerId][equals]=${id}`
    : `where[and][0][ownerId][equals]=${id}&where[and][1][status][equals]=published`,
  sort: '-updatedAt',
  limit: 1
});
context.contentId = version?.id;
```

`findMany` inverts rather than filters. Today it queries the base table and pulls one content row
in through a `with`, which is why the status filter had to be injected into somebody else's `where`
clause. The content table is where the filterable and sortable columns actually are — `where`
resolves against the shadow's slug, and `orderBy` was handed the shadow's table name in 25a78cdc —
so the natural shape is to list the shadow and fetch the base rows by id.

**The cost, stated honestly:** a versioned read goes from one query to two, and a versioned list
from one to two. Not N+1 — the second query is `where id in (…)` — and the second one is a plain
lookup by primary key. In exchange the branch disappears from the database layer entirely and a
second adapter gets versions for free instead of re-implementing the ladder.

**And what it costs nothing in:** atomicity. `grep -rn "transaction\|\.batch(" src/lib/adapter-sqlite/*.ts`
returns nothing — there are no transactions in the adapter today, so splitting a read or a write
into two calls loses a guarantee that was never there. That was the strongest argument for keeping
the branching low and it does not hold.

### Stage 4 — the write plan moves up ✅ update half done (`1ec2dfca`, `5dac93c0`)

`updatePrototype` took a `versionOperation` and decoded it into three branches. Diffed, they
differed in exactly two facts:

```
isSimpleUpdate           base <- all of data             no content row exists
isSpecificVersionUpdate  base <- root, content <- rest    write the content row
isNewVersionCreation     base <- root                     handleNewVersion already wrote it
```

Both are settled before the call, and the second one **only `versions` can answer** — it is the
feature that creates the row, through the public API. So the caller names the rows and the adapter
writes them:

```ts
// core/adapter.ts
update(args: { id?: string; data: Dic; content?: { id: string; data: Dic }; locale?: string });
```

One path, no branches, no `config`, no `versionOperation`. `content` absent covers two different
situations — no content row at all, or one somebody else already wrote — and the adapter does not
need to tell them apart.

**How the plan is built.** `FeatureDefinition.writePlan` refines `{ data }` into
`{ data, content? }`, folded in feature order and gated by `enabled` — the same seam as `validate`,
`blank` and `shadow`. Only `versions` declares one:

```ts
// core/features/versions/write-plan.ts
export const versionsWritePlan = (plan, { config, context }) => {
  const { versionOperation, contentOwnerId } = context;
  const { base, content } = splitRootData(plan.data, config); // ._root() fields stay on the base row

  return VersionOperations.isNewVersionCreation(versionOperation!)
    ? { data: base } // handleNewVersion wrote the row already
    : { data: base, content: { id: contentOwnerId!, data: content } };
};
```

`runUpdate` folds it at step 3.5, after the data hooks and before the write.

**Not a hook, and this is the load-bearing part of the design.** The plan has to be built after
_every_ data hook, and no mark can express that: a consumer's `beforeUpdate` hook declares
`requires: ['validated']` and provides nothing, so there is no mark a plan step could wait on, and
a consumer hook that rewrote `data` would be silently split around. `runUpdate` owns the
sequencing; the feature owns only its half.

`contentOwnerId` stays and does **not** merge into the plan. Different questions: `contentOwnerId`
is where blocks, tree nodes and relations hang, and is set in all three cases; `content` is what
this write touches, and is absent in the third. They name the same row when both are set.

**The one new primitive**, shipped first in `1ec2dfca`:

```ts
updateWhere(args: { query: OperationQuery; data: Dic }): Promise<void>;
```

A table, a filter, a patch. The publish demotion — "set every other version of this document to
draft" — was three lines of raw drizzle in the adapter, guarded by `config.versions.draft`; it is a
`beforeUpdate` hook on the versions feature now. Two details it depends on: `updateWhere` writes
exactly the columns given, `updatedAt` included only if passed (pruning orders by `updatedAt`, so
stamping it would silently re-order which versions survive), and it takes the same REST-shaped
query every other operation takes rather than a second dialect.

It is also the first hook the versions feature _carries_. `buildPipeline` gates a feature's hooks
behind `enabled`, which is wrong for `defineVersionOperation` and `handleNewVersion` — they run for
every config, versioned or not — but exactly right for a demotion, since a config with no drafts
has nothing to demote.

Ordering note: the demotion and the write of the published row are two statements with no
transaction around them, and were not before either. A reader between them sees the document with
no published version.

**What is left of stage 4.** The insert half. `insertPrototype` still calls `splitRootData` itself,
and `ensurePrototypeExists` still reads `config.versions.draft` to publish a first version — the
last one on any write path. An insert has no row to name yet, so a plan cannot say what it says for
an update; the shape it wants is `content?: { data }` with no id, and the adapter returning the id
it generated. Worth doing, but a different argument from this one.

### Stage 5 — the remainder

`core/constants.ts` (`VERSIONS_STATUS`), `core/pipeline/types.ts` importing `VersionOperation`,
`core/dev/codegen/routes/common.server.ts`'s versions pages, and
`core/pipeline/persist/{blocks,relations,tree}` importing `contentOwnerSlug`. Most fall out of
Stages 2–4; whatever is left is the honest remainder and belongs in the audit rather than being
forced.

### Settled on the way: how the adapter knows it has a shadow

Not from a config member. `buildOrderByParam` asked `!!config.versions` and then rebuilt the
shadow's name by calling the versions feature's own `withVersionsSuffix`; `buildWhereParam`
recognised a shadow with `hasVersionsSuffix(slug)`. All three named a feature inside the database
layer, and the first two asked a config a question the schema already answers.

Registration carries the shadow, so the caller resolves the table once and the builders are told:

```ts
buildOrderByParam({ slug, tables, by, shadow }); // shadow?: TableName
const hasShadow = !!shadow && shadow in tables; // presence in the schema, not a config member

buildWhereParam({ query, slug, base, … }); // base?: PrototypeSlug — what this shadow stands for
const isShadow = !!base;
```

`hasVersionsSuffix` was load-bearing beyond naming — it is what made `id` mean the base row and the
hierarchy columns resolve through it — so a _second_ feature declaring a shadow would silently have
got neither behaviour. Done in 25a78cdc, ahead of stages 3–5 because every one of them reads these
builders.

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
  flight — `undefined`, silently. `prototype/collection/pipeline.spec.ts` fails when it
  happens.

- **A pipeline is resolved once, at the end of the config build.** `prototype/pipelines.server.ts`
  walks every prototype config the finished config carries — authored or derived — and resolves
  each from three lists: the prototype's own hooks, the hooks of the features _that config_
  enables, and the author's `$hooks`. Derivations therefore have to happen **before** it, which is
  what `configure` is for; a derived collection that tried to carry a pipeline of its own would be
  inheriting one resolved for somebody else's features, against columns its table does not have.
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

- **`prototype/collection/pipeline.spec.ts`** must stay green — it catches a derived
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

## Decisions

1. **Does `pick` live in the declaration, or does the feature resolve the content id first?** Open,
   and deliberately not settled by Stage 2: the schema half needs neither, so it declares neither.
   The declaration keeps reads at one query and puts a small predicate in the contract; resolving
   first keeps the contract clean and costs a query per read. Measure the read path before
   choosing.
2. **Does `insert` still write the first content row?** It is the one place the adapter creates a
   shadow row on its own. The alternative — the feature creating it through the public API, as
   `handleNewVersion` already does — is more consistent and costs a round trip on every create.
3. **Is `status` the adapter's business at all?** It is a normal field on the shadow collection,
   added by versions' augment. Only the demotion and the published-or-latest pick read it, and both
   are candidates to move above the adapter.
