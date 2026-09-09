# Composable and readable

## The model: SvelteKit

**Declarative — you see what you implement.** `+page.server.ts` exports `load` and `actions`. The
file *is* the declaration. There is no `definePage({ load, actions })` handing a config object to a
factory that folds it later.

**File convention over configuration.** SvelteKit never asks a page to declare its capabilities.
The filename says what the file is, the exports say what it does, and the framework looks where the
convention says to look.

`definePrototype` stays — a prototype is a real thing with a name, a factory and a REST surface, and
there are two of them. **`defineFeature` goes.** A feature is not a thing; it is a folder of
functions a prototype composes.

---

## 1. What the ceremony costs, measured

Ten `index.ts` manifests — `defineFeature({…})` plus a `declare module` — total **383 lines**:

| feature | total lines | manifest | |
| ------- | -----------: | -------: | - |
| metas | 38 | 19 | **50% of the feature is its manifest** |
| nested | 123 | 73 | **59%**, counting its `module.ts` pair |
| title | 167 | 35 | **five files** for one augment and one hook |
| cors | 141 | 28 | and `augmentCORS` is a `configure`, misnamed |
| panel | 116 | 53 | manifest is the largest file in the folder |
| url | 209 | 37 | |
| thumbnail | 161 | 32 | |
| upload | 1710 | 38 | |
| versions | 782 | 79 | |
| auth | 2016 | 71 | |

Plus `features/define.ts` 295, `fold.ts` 202, `apply.ts` 34, `tables.ts` 53, `register.ts` 114 —
**698 more lines of protocol**.

## 2. Two duplications, both found by reading

### `FeatureConfigAugment` restates what `BuiltCollection` already says

`core/config/types.ts` declares, by hand:

```ts
export type BuiltCollection = … & {
  asTitle: string;                      //  title  declares `T & { asTitle: string }`
  asThumbnail: string | null;           //  thumbnail declares the same
  auth?: CollectionAuthConfig;          //  auth   declares `WithNormalizedAuth<T>`
  versions?: Required<VersionsConfig>;  //  versions declares `WithVersionsConfig<T>`
  upload?: UploadConfig;                //  upload declares `WithNormalizedUpload<T>`
};
```

**All five, twice.** Once concretely in core, once through a declaration-merging target that
`ApplyAugments` folds over a tuple of names that `FeatureNames` maps off the features list.

`FeatureConfigAugment`, `ApplyAugments`, `Augmented`, `FeatureNames` — the whole apparatus
reproduces a type that is already written down, and `FeatureNames`/`Augmented` are already dead
exports.

### `FeatureConfigure` imports the type it then declares

`features/panel/index.ts` imports `PanelConfig` from `core/config/types.ts`, then merges a
declaration back so that core knows what panel adds. The type is already core's. Same for cors and
`$trustedOrigins: string[]`.

**Both merging targets go.** `register.ts` keeps `FeatureDocTypes` — four shapes core genuinely
does not own — and nothing else.

## 3. The convention

Every folder that extends something uses the same file names. No `index.ts` manifest anywhere.

| file | exports | read by |
| ---- | ------- | ------- |
| `augment.ts` | one function, shapes **one prototype config** | that prototype's `augments` list |
| `configure.ts` | one function, shapes **the whole config** | `config/build.ts` |
| `enabled.ts` | one predicate | the `when(…)` guards in both lists |
| `hooks/<verb>.server.ts` | one hook | the prototype's `hooks.server.ts` |
| `hooks/index.server.ts` | barrel | same — this one stays, it is a barrel not a manifest |
| `handler.server.ts` | one request handler | `handlers/index.ts` |
| `boot.server.ts` | one boot step | `boot.server.ts` |

A folder that adds a capability adds a file. Nothing declares that it did.

**One file per exported thing only when it earns it.** `versions/read-query.ts` is a 12-line
function under 27 lines of comment in a file of its own; it belongs with `write-plan.ts` in
`versions/rows.ts` — *which row a read means, which rows a write touches* is one subject. Same
test everywhere: `metas/augment.ts` at 19 lines needs no folder around it.

## 4. Where things live

Two rules, applied in order.

1. **Core and the adapter may name `auth`, `locale`, `versions`, `metas`.** They are constitutive
   and three of the four are already named in the adapter. Those live in `core/`.
2. **Everything else lives at the scope it extends** — the prototype whose configs it touches, or
   `core/` when it touches no prototype at all.

Which gives, from the two `features` lists as they stand:

| thing | augments | goes to |
| ----- | -------- | ------- |
| auth | collection | `core/auth/` — the adapter names it |
| versions | both | `core/versions/` — the adapter names it |
| metas | both | `core/metas/` — `updatedAt` is in `BaseDoc` and 29× in the adapter |
| cors | neither — `configure` only | `core/cors/`, and `augmentCORS` → `configureCORS` |
| panel | neither — `configure` only | `core/panel/` |
| upload | collection | `prototype/collection/upload/` |
| nested | collection | `prototype/collection/nested/` |
| thumbnail | collection | `prototype/collection/thumbnail/` |
| title | both | `prototype/shared/title/` |
| url | both | `prototype/shared/url/` |

`features/` is empty at the end, and that is the honest outcome: there was never a feature layer,
there were four core concerns, two whole-config defaults, three collection extensions and two
shared ones.

### The tree

```
core/
  adapter.ts  boot.server.ts  rime.server.ts
  auth/       augment.ts  configure.ts  enabled.ts  hooks/  handler.server.ts  better-auth/
  versions/   augment.ts  rows.ts  hooks/  naming.ts  strategy.ts
  metas/      augment.ts
  cors/       configure.ts  handler.server.ts
  panel/      configure.ts  icons.ts
  pipeline/
    hooks/    ← was steps/
    build.server.ts  run.server.ts  types.ts
  prototype/
    define.ts  doc.ts  naming.ts  types.ts
    collection/
      definition.ts  hooks.server.ts  api.server.ts  operations/  rest/
      upload/     augment.ts  enabled.ts  hooks/  disk/  path.ts
      nested/     augment.ts  enabled.ts  hooks/
      thumbnail/  augment.ts  hooks/  find-thumbnail.ts
    area/
      definition.ts  hooks.server.ts  api.server.ts  operations/  rest/
    shared/
      title/  augment.ts  hooks/  find-title.ts
      url/    augment.ts  enabled.ts  hooks/
```

## 5. What a prototype then reads like

```ts
// prototype/collection/definition.ts
export const collection = definePrototype({
  name: 'collection',
  singleton: false,
  augments: [
    augmentLabel,
    when(isAuth, augmentAuth),
    when(isUpload, augmentUpload),
    when(isNested, augmentNested),
    augmentVersions,          // self-gates already: `if (versions) {…}`
    when(hasUrl, augmentUrl),
    augmentTitle,
    augmentThumbnail,
    augmentMetas
  ]
});
```

No `features` array, no `enabled` fold, no `applyAugments`. `when(pred, fn)` is three lines and
replaces `FeatureDefinition.enabled` and `buildPipeline`'s `enabled` map. **Six of the ten features
declare `enabled: () => true` today** — they get no guard at all.

The order is still column order, declared once, and now you read what runs and what guards it in
one place. The hook lists take the same treatment where a gate is needed:

```ts
beforeRead: [when(isAuth, removePrivateFields), processDocumentFields, …]
```

## 6. The adapter

`shadow` → `versions` in all **116 places** across ten files. The decoupling renamed versions
rather than removing it; the adapter already says `locale` 18 times in the contract and carries an
`AuthAdapter` member. Three constitutive concepts, two named, one disguised.

Then the names that say nothing:

| file | lines | rename / split |
| ---- | ----: | -------------- |
| `prototype.server.ts` | 649 | split by verb: `read.server.ts`, `write.server.ts` |
| `util.server.ts` | 368 | `columns.server.ts` — it is column and primary-key work |
| `with.server.ts` | 313 | `select.server.ts` — "with" is drizzle's word, not a description |
| `orderBy.server.ts` | 164 | `order-by.server.ts` — every other file is kebab |
| `ShadowDeclaration` | — | `VersionsTable` |
| `WritePlan { data, content }` | — | `{ base, version }` |

And in core the three versions folds collapse:

| was | becomes |
| --- | ------- |
| `shadowOf(features, config)` ×5 | `config._versions`, stamped by `augmentVersions` |
| `readQueryOf(features, …)` | `versionsReadQuery(…)`, imported |
| `writePlanWithFeatures(features, …)` | `versionsWritePlan(…)`, imported |
| `ConfigContext.shadowSlugOf` | gone — anyone with the config reads the member |

## 7. `core/auth/tables.ts`

161 lines transcribing better-auth's five tables as column declarations. When better-auth changes
its schema, somebody diffs their release notes against this file by hand. It is not better than the
template string it replaced — it is further from drizzle, and `TableDeclaration` exists for this one
caller.

**Generate it.** Better-auth ships a CLI that emits a drizzle schema for the configured plugin set;
that output is what to consume. **Verify first** — check what it emits for this plugin list and
whether it can target the schema file codegen already writes. If it cannot, the fallback is to move
the declarations beside `better-auth/config.server.ts`, where the plugin list they mirror already
lives, so the two are read together.

`authColumns` stays: `authUserId` and `isSuperAdmin` are rime's columns on rime's table.

---

## The order

Each is one commit. None depends on a later one.

| # | move | size | gate |
| - | ---- | ---: | ---- |
| 1 | dead fields — `FeatureDefinition.type`, `.requires`, `PrototypeDefinition.titleFallback` | ~55 | `check` |
| 2 | `pipeline/steps/` → `pipeline/hooks/`; adapter file renames and the 649-line split | ~0 net | `check`, `madge` |
| 3 | the folder moves of §4 — nothing edited, only moved | ~0 net | `check`, `madge`, generated output identical |
| 4 | adapter says `versions` — mechanical, 116 places | ~0 net | **schema byte-identical** |
| 5 | the three versions folds collapse; `WritePlan` → `{ base, version }` | −120 | schema identical, `test:versions` |
| 6 | auth's `validate` → import; `tables`/`columns` → config data | −90 | schema identical, `test:basic` |
| 7 | `upload.boot` → `await bootUpload(config)` | −15 | `test:basic` |
| 8 | composition lists + `when()`; delete `applyAugments` | −60 | **schema identical** (field order = column order), hooks chart identical |
| 9 | delete both merging targets; `BuiltConfig` names `panel` and `$trustedOrigins` | −180 | `check` on **two** fixtures, `inference.spec.ts` |
| 10 | delete `defineFeature`, `features/define.ts`, `fold.ts`, `apply.ts`, `tables.ts`, ten manifests | −900 | `check`, full e2e |
| 11 | better-auth schema — investigate first | ? | schema identical |

Roughly **1400 lines deleted**, no behaviour changed, and every step gated on the generated schema
being byte-identical — which is headless and takes seconds:

```
rm node_modules/.rime/config.txt && bun ./src/lib/core/dev/cli/index.ts generate --force
```

## The test

Four files explain the system end to end, and none of them is a fold:

1. `core/prototype/collection/definition.ts` — what a collection is, composed in one list.
2. `core/prototype/collection/hooks.server.ts` — what runs, in order.
3. `core/boot.server.ts` — the eight steps that happen once.
4. `core/adapter.ts` — what a database must provide, in words that mean what they say.

If a move lands and this needs a fifth, the move was wrong.

## Risk register

| risk | bites | caught by |
| ---- | ----- | --------- |
| a composed list reordered | column order changes → unrequested migration | schema byte-identical |
| a `when` guard forgotten | an augment runs on configs without the feature | schema diff, then `test:basic` |
| the 116-place rename slipping one | a table resolves to the wrong name | schema byte-identical |
| a hook lost in a folder move | documents with no title, no url | hooks chart identical, `hook-placement.spec.ts` |
| move 9 widening a slug literal | consumer apps lose `rime.collection(…)` autocomplete | `check` on two fixtures |
| a `$rime/modules` pair broken by a move | 500 on every module request, message names nothing | **load the panel in a browser** — CONTRIBUTING rule 7 |

That last one has no static gate. Every folder move that touches a `module.ts` / `module.server.ts`
pair needs a browser check before the commit.

## What is not on the table

Throwing the branch away. `develop` has no `Adapter` interface — its core is `areas/`,
`collections/`, `operations/`. That one file is the only thing here that cannot be redone in an
evening, because writing it meant finding every place the database layer knew what a draft was.
Everything above is deletion.
