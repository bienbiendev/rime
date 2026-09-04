# Decoupling `versions` from the adapter

Cold-start handoff. Assumes no context beyond `docs/architecture-target.md`'s three layers.

`versions` is registered as a feature and behaves like a dialect: three of its concepts —
`versionId`, `draft`, `versionOperation` — are **parameters of the adapter contract**, so every
prototype and every adapter pays for them whether or not a config uses versions. This file is what
to know before changing that, and a staged plan for doing it.

The sibling doc `docs/decoupling-adapter.md` covers the vocabulary the adapter already speaks
(base / shadow / child / branch). Read its **Vocabulary** section first; this one assumes it.

---

## The mechanism, in one page

**The shadow is a real collection.** `versions`' `configure` derives `$pages__versions` for every
versioned config (`features/versions/derive.server.ts`), builds it as a `BuiltCollection`, and
attaches the collection prototype's pipeline to it. `contentOwnerSlug(config)` — `features/versions/naming.ts`
— is the load-bearing line: `owner = shadow ?? base`, so enabling versions moves a document's whole
child subtree (blocks, tree, relations) onto the shadow.

**Five operations, chosen above the adapter.** `defineVersionUpdateOperation({ draft, versionId, config })`
in `features/versions/strategy.ts` picks one of `UPDATE`, `UPDATE_VERSION`, `UPDATE_PUBLISHED`,
`NEW_VERSION_FROM_LATEST`, `NEW_DRAFT_FROM_PUBLISHED`. It is the `defineVersionOperation` hook,
listed in both prototypes' `beforeUpdate`.

**Where the adapter branches on it**, all in `adapter-sqlite/`:

| place                                   | what it does                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `prototype.server.ts` `readPrototype`   | when `config.versions`, joins the shadow table and picks the named version, or published-or-latest |
| `prototype.server.ts` `updatePrototype` | three branches on `versionOperation` (below)                                                       |
| `prototype.server.ts` `insertPrototype` | writes root + first version row, returns `{ id, versionId }`                                       |
| `url.server.ts`                         | four writes: root, root locale, version, version locale                                            |
| `generate-schema/index.server.ts`       | builds the shadow table and the root↔shadow relations from `config.versions`                       |

The three update branches, and this is the important part:

- **`isSimpleUpdate`** (not versioned) — write the root row, everything on it.
- **`isSpecificVersionUpdate`** — write `rootData` to the root, the rest to the version row named by
  `versionId`; if publishing, first demote this document's other versions to draft.
- **`isNewVersionCreation`** — write `rootData` to the root **and nothing else**. The version row was
  already created by `handleNewVersion`, through the public API:
  `rime.collection($pages__versions).create(...)`.

That last line is the proof the strategy can live above the adapter: two of the five operations
already do.

---

## The observation the plan rests on

> `context.params.versionId` is not a version id. It is **the id of the row that owns this
> document's children**.

`handleNewVersion` ends with `default: versionId = originalDoc.id` — for a non-versioned document
it is the document's own id — and `run.server.ts` then passes it as `ownerId` to
`persistRelational`. `insertPrototype` says the same in its own words: "For a non-versioned
prototype `versionId` comes back equal to `id`".

So the pipeline does not have a versions concept in it. It has a **content owner** concept, wearing
a versions name. Rename it and most of the coupling turns into a question with an obvious answer:
children belong to a row, and `versions` is the feature that changes which row that is.

---

## What decoupled looks like

The adapter contract stops naming versions and gains one neutral idea — _which row holds the
content_:

```ts
find(args?: { id?: string; contentId?: string; … })
update(args: { id?: string; contentId?: string; data; locale? }): Promise<{ id: string }>
insert(args: { data; locale? }): Promise<{ id: string; contentId: string }>
```

`contentId` defaults to the root row. A prototype with no shadow never sets it, and its adapter
paths are the `isSimpleUpdate` branch with no branch left in them.

Two things do **not** decouple by renaming, and they are the real work:

1. **Choosing the content row on a read.** `published-or-latest`, or "the one named by `versionId`",
   or "the newest" — `buildPublishedOrLatestVersionParams` in `adapter-sqlite/util.server.ts`. The
   adapter has to resolve it inside the read query; asking the feature first costs a second query
   per read.
2. **Generating the shadow table.** `generate-schema` builds it because `collection.versions` is
   truthy. Nothing reads the feature's `type: 'shadow'` declaration.

Both point the same way: **the shadow becomes something a feature declares at registration**, and
the adapter is told about it once, at boot, the way prototypes already are
(`adapter.registerPrototype({ config, singleton })`, `adapter-sqlite/registry.server.ts`).

Sketch, to be argued with rather than followed:

```ts
registerPrototype({
  config,
  singleton,
  shadow: {
    slug: '$pages__versions', // where the content rows live
    ownerColumn: 'ownerId', // how they point back
    pick: { column: 'status', equals: 'published' } // else newest by updatedAt
  }
});
```

`pick` is the part to be careful with: it is one step from inventing a query language in the
adapter contract. If it grows past "a column equals a value, else newest", stop and reconsider —
resolving the id above the adapter and paying the extra query may be the better trade.

---

## The plan, in stages

Each stage is shippable on its own and gate-able against the previous one. Stage 0 and 1 have no
design questions left in them.

### Stage 0 — `_root` fields stop being a hardcoded list

`adapter-sqlite/util.server.ts` `extractRootData()` hardcodes `_parent`, `_position` and `_path` —
two features' fields, named in the adapter. Those fields are already declared with `._root()`
(`fields/builders/form-field-builder.ts:129`, set by `features/nested/module{,.server}.ts` and
`features/upload/module.ts`), and the flag survives into the compiled field as `root: true`.

Read the flag off the config instead of matching names. Self-contained, no contract change, and it
removes two feature names from the adapter. **Do this first** — it is the smallest possible version
of the whole exercise, and it proves the fixtures and gates below work.

### Stage 1 — `versionId` → `contentOwnerId`, no behaviour change

Rename through `core/pipeline/` and `core/adapter/types.ts`: the pipeline's
`context.params.versionId`, `assertUpsertContext`'s required list, `persistRelational`'s `ownerId`
argument, `insert`'s return. Leave `features/versions/` speaking of versions — inside the feature
the name is correct.

Mechanical, and the point of doing it alone is that the diff shows exactly which remaining
references are genuinely about versions. Expect the count in `core/` to drop by more than half.

### Stage 2 — the shadow is registered, not inferred

`FeatureDefinition` gains a `shadow?: (config) => ShadowDeclaration`, read at
`registerPrototype` time. `generate-schema` builds tables from registered shadows rather than from
`config.versions`. The feature's `type: 'shadow'` finally means something.

This is the stage that touches the generated schema. Capture a golden schema on **`versions` and
`versions-multilang`** first (see Gates).

### Stage 3 — the read selector

`find`/`findMany` lose `draft` and `versionId`, gaining `contentId` plus whatever Stage 2's
declaration says about picking a row. `buildPublishedOrLatestVersionParams` becomes a function of
the declaration rather than of `config.versions`.

### Stage 4 — the write plan

`versionOperation` leaves the adapter contract. `updatePrototype` becomes: write `rootData` to the
root row, write the rest to `contentId` when one was given. The publish demotion (`status = draft`
on siblings) moves above the adapter into the versions feature, where the other two operations
already are.

### Stage 5 — what is left over

`core/constants.ts` (`VERSIONS_STATUS`), `core/pipeline/types.ts` importing `VersionOperation`,
`core/dev/codegen/routes/common.server.ts`'s versions pages, and
`core/pipeline/persist/{blocks,relations,tree}` importing `contentOwnerSlug`. Most of these fall out
of Stages 2–4; whatever is left is the honest remainder and belongs in the audit rather than being
forced.

---

## Traps

- **The hooks cannot be gated by `enabled`.** `defineVersionOperation` populates
  `context.versionOperation`, which `assertUpsertContext` requires on _every_ update — so both
  prototypes list versions' `beforeUpdate` hooks directly, and gating them behind the feature
  breaks updates on non-versioned configs. Stage 1 is what makes this fixable: once the context
  carries a content owner rather than a version operation, a non-versioned config needs nothing
  from the feature. Do not try to fix the listing before Stage 1.
- **A feature must not import a prototype definition.** `versions/derive.server.ts` needs the
  collection prototype's `features`; it takes them from the registry handed to `configure`. A
  definition lists its features by value, so importing one from inside a feature can be evaluated
  _from within_ that definition and find the feature still in flight — `undefined`, silently. See
  `prototype/collection/config/pipeline.spec.ts`, which fails when that happens.
- **The shadow is a collection, so it runs the collection pipeline.** Anything added to the
  collection prototype's hooks runs for `$pages__versions` too. That is intended, and it is why
  `derive.server.ts` calls `augmentHooks`.
- **`$` and `__` are load-bearing in slug space.** `$` marks rime-derived, `__` marks _shadow of_
  and survives case conversion as a segment boundary; `config/validate.server.ts` rejects an author
  slug containing `__` for that reason. Do not invent a third marker.

---

## Gates

The standing gates are in `docs/restructure-handoff.md`. What is specific to this work:

- **Run on a versions fixture.** `bun run rime:use versions`, and `versions-multilang` for anything
  touching locales — the localized version table (`__versions__$$locales`) is where the four-way
  `url.server.ts` write lives. Re-measure every baseline after switching fixture: the counts differ
  per fixture and comparing across two reads as a regression that is not there.
- **Golden schema, per fixture.** Stage 2 onwards changes how the shadow table is generated. Boot,
  copy `src/lib/+rime.generated/schema.server.ts` somewhere outside the repo, change, boot, diff.
  A shadow that silently stops being generated shows up here and nowhere else.
- **`prototype/collection/config/pipeline.spec.ts`** must stay green: it is what catches a derived
  collection losing its hooks.

### Probes, and what each one discriminates

Seed an admin (`POST /api/init`, see the handoff for the payload), then:

| probe                                                           | what breaks it                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| create a versioned doc, read it back                            | the shadow join, `insert` returning both ids                                           |
| update it, then read                                            | `contentId` threading — a wrong owner writes children onto the root                    |
| publish, then create a second draft, then read without `?draft` | the published-or-latest pick                                                           |
| publish the second draft, then list versions                    | the demotion — exactly one published at a time                                         |
| a versioned **area** with only a draft                          | must 404, not return the empty root row                                                |
| blocks or a relation on a versioned doc, updated twice          | children written against the wrong owner survive one write and duplicate on the second |

The last one is the reason to care: an owner-id mistake is invisible on a single write.

---

## Decisions to make before Stage 2

1. **Does `pick` live in the declaration, or does the feature resolve the content id first?** The
   declaration keeps reads at one query and puts a small predicate in the contract. Resolving first
   keeps the contract clean and costs a query per read. Measure the read path before choosing.
2. **Does `insert` still write the first content row?** It is the one place the adapter creates a
   shadow row on its own. The alternative — the feature creating it through the public API, as
   `handleNewVersion` already does — is more consistent and costs a round trip on every create.
3. **Is `status` the adapter's business at all?** It is a normal field on the shadow collection,
   added by versions' augment. Only the demotion and the published-or-latest pick read it, and both
   are candidates to move above the adapter.
