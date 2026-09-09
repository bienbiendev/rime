# Composable and readable — the rest of it

Moves 1–7 landed (`70283dd6`…`317658dc`). `FeatureDefinition` is 295 → 145 lines, `fold.ts` 202 →
98, and every seam with one implementer is gone. What follows finishes the job: **`defineFeature`
and `features/` do not exist at the end**, and `core/config/` stops being a soup folder.

## Where it stands

```
core/features/          the protocol, 646 lines, all of it going
  define.ts      145    FeatureDefinition + defineFeature
  register.ts    114    FeatureConfigAugment, FeatureConfigure, FeatureDocTypes
  fold.ts         98    4 folds
  tables.ts       53    TableDeclaration, ColumnDeclaration
  apply.ts        34    applyAugments (+ 2 dead type exports)
  doc-type.ts     27    DocTypeContribution
```

`FeatureDefinition` now holds six things: `name`, `enabled`, `augment`, `configure`, `blank`,
`docType`. Below, each finds a home and the type disappears.

## The soup: `core/config/`

`types.ts` alone is **470 lines and 27 exports**, and twelve of them are other people's:

| type | owner | reads it back |
| ---- | ----- | ------------- |
| `VersionsConfig` | versions | `versions/augment.ts` imports it, then declares into `FeatureConfigAugment` |
| `UploadConfig`, `ImageSizesConfig` | upload | same shape |
| `CollectionAuthConfig`, `AdditionalStaffConfig` | auth | same |
| `PanelConfig`, `CollectionPanelConfig`, `CustomPanelRoute` | panel | `panel/index.ts` imports `PanelConfig`, then declares it back into `FeatureConfigure` |
| `LocalizationConfig`, `LocaleConfig` | locale | — |
| `CacheConfig` | the cache plugin | — |
| `CollectionLabel` | the collection prototype | — |

That is the circle you named: core owns the type, the feature imports it, the feature declares it
back so core can know about it. Half the job, twice.

And two files in the folder are not config:

| file | is | goes |
| ---- | -- | ---- |
| `write.server.ts` (82) | serialises a config memo for codegen's change detection | `core/dev/` |
| `augment-plugins.ts` (32) | one function, one caller | into `build.ts` |

What is genuinely config: `build.ts` / `build.server.ts` (the chain), `context.server.ts`
(`ConfigContext`), `validate.server.ts`, `index.ts` / `index.server.ts` (the public barrels), and a
`types.ts` holding only what no one else owns — `Config`, `BuiltConfig`, `Access`, `RouteConfig`.

---

## Move 8 — the augment chain is written down

```ts
// prototype/collection/definition.ts
augments: [
  augmentLabel,
  when(isAuth, augmentAuth),
  when(isUpload, augmentUpload),
  when(isNested, augmentNested),
  augmentVersions,          // self-gates already
  when(hasUrl, augmentUrl),
  augmentTitle,
  augmentThumbnail,
  augmentMetas
]
```

`when(pred, fn)` is three lines. It replaces `FeatureDefinition.enabled` at the augment site and
`buildPipeline`'s `enabled` map at the hook site. Six of the ten features declare
`enabled: () => true` — they get no guard.

**Deletes:** `applyAugments`, `features/apply.ts`, `FeatureDefinition.augment`, and the
`features` array on `PrototypeDefinition` — with the chain written, nothing folds a list.

**Gate:** generated schema **byte-identical**. Field order is column order (rule 2), so a
mis-ordered list is a schema diff and nothing else would catch it.

## Move 9 — both merging targets

`FeatureConfigAugment` declares five members `BuiltCollection` already declares by hand —
`asTitle`, `asThumbnail`, `auth`, `versions`, `upload`. `FeatureConfigure` declares two that core
already owns the types of. Neither survives.

**Deletes:** `FeatureConfigAugment`, `ApplyAugments`, `Augmented`, `FeatureNames`,
`FeatureConfigure`, `ConfigureTransforms`, `ApplyFeatureConfigure`, and the ten `declare module`
blocks. `register.ts` is left with `FeatureDocTypes`, which moves in Move 10.

**Gate:** `check` on **two** fixtures and `config/inference.spec.ts`. This is the one that can
widen a slug literal and cost consumers their autocomplete.

## Move 10 — `defineFeature` and `features/` are deleted

The four folds and the four remaining types each go to whoever asks the question:

| what | goes to | why |
| ---- | ------- | --- |
| `configureWithFeatures` + `distinctFeatures` | `config/build.ts` — a written chain of `configure` calls | two callers, both there |
| `blankWithFeatures` | `prototype/doc.ts`, as two calls: auth's and versions' | three callers |
| `docTypeWithFeatures` + `DocTypeContribution` | `dev/codegen/types/` | one caller, and it is codegen's question |
| `FeatureDocTypes` | `prototype/types.ts`, beside `Docs` which merges it | four declarers, all still valid |
| `TableDeclaration`, `ColumnDeclaration` | `core/adapter.ts` | the adapter's vocabulary; auth and the generator are the only users |
| `FeatureDefinition`, `defineFeature`, `register.ts`, `fold.ts`, `apply.ts`, `tables.ts`, `doc-type.ts` | **deleted** | |

Then every `<thing>/index.ts` manifest goes with it. Ten files, 383 lines, replaced by the file
convention: `augment.ts`, `configure.ts`, `enabled.ts`, `hooks/`, `handler.server.ts`. A folder
that adds a capability adds a file; nothing declares that it did.

**Gate:** `check`, full `vitest`, generated schema and hooks chart identical, and **the panel in a
browser** — this move touches every `$rime/modules` pair, and rule 7's failure has no static gate.

## Move 11 — versions and metas are the prototypes'

```
core/versions/  ->  prototype/shared/versions/
core/metas/     ->  prototype/shared/metas/
```

Both augment a prototype config, and both augment *both* prototypes, which is what
`prototype/shared/` means. `core/` keeps what extends no prototype: `auth/` (its own tables, its
own handler, an `AuthAdapter` member on the contract), `cors/` and `panel/` (whole-config only).

A pure move. **Gate:** `check`, `madge`, generated output identical, browser.

## Move 12 — `core/config/` stops being a soup

| type | to |
| ---- | -- |
| `VersionsConfig` | `prototype/shared/versions/types.ts` |
| `UploadConfig`, `ImageSizesConfig` | `prototype/collection/upload/types.ts` |
| `CollectionAuthConfig`, `AdditionalStaffConfig` | `core/auth/types.ts` |
| `PanelConfig`, `CollectionPanelConfig`, `CustomPanelRoute` | `core/panel/types.ts` |
| `LocalizationConfig`, `LocaleConfig` | `core/locale/types.ts` (new folder — locale is core, and today it is scattered) |
| `CacheConfig` | `core/plugins/cache/types.ts` |
| `CollectionLabel`, `CollectionHooks`, `BuiltCollection`, `Collection` | `prototype/collection/types.ts` |
| `AreaHooks`, `BuiltArea`, `Area` | `prototype/area/types.ts` |

`config/types.ts` keeps `Config`, `BuiltConfig`, `Access`, `RouteConfig`, and the `…Client`
aliases — 470 lines down to roughly 120. `write.server.ts` moves to `core/dev/`;
`augment-plugins.ts` folds into `build.ts`.

**Watch for a cycle.** `BuiltCollection` living in `prototype/collection/types.ts` while
`Config` names `collections?: BuiltCollection[]` is `config → prototype → config`. It is
type-only, which madge does not count and TypeScript resolves lazily, but it is exactly the shape
rule 1 warns about. **Gate: `check` on two fixtures, `madge`, and `inference.spec.ts`.** If the
count moves, split the leaf types out rather than forcing it.

## Move 13 — better-auth's schema

`core/auth/tables.ts` is 161 lines transcribing better-auth's five tables. Generate them from
better-auth's own CLI instead. Investigate first; the fallback is to move the declarations beside
`better-auth/config.server.ts`, where the plugin list they mirror already lives.

---

## The order

| # | move | gate |
| - | ---- | ---- |
| 8 | augment chain written; `applyAugments` deleted | **schema byte-identical** |
| 9 | both merging targets deleted | `check` on **two** fixtures + `inference.spec.ts` |
| 10 | `defineFeature` and `features/` deleted; ten manifests deleted | `check`, vitest, schema, chart, **browser** |
| 11 | versions and metas to `prototype/shared/` | `check`, madge, **browser** |
| 12 | `core/config/` de-souped | `check` on **two** fixtures, madge, `inference.spec.ts` |
| 13 | better-auth schema | schema identical |

Each is one commit, none depends on a later one, and 8 before 9 before 10 because each strips what
the next would otherwise have to keep working.

## The test

Four files explain the system, and none of them is a fold:

1. `prototype/collection/definition.ts` — what a collection is, composed in one list.
2. `prototype/collection/hooks.server.ts` — what runs, in order.
3. `boot.server.ts` — the steps that happen once.
4. `adapter.ts` — what a database must provide.

## Risk register

| risk | bites | caught by |
| ---- | ----- | --------- |
| a composed list reordered | column order changes → unrequested migration | schema byte-identical |
| a `when` guard forgotten | an augment runs where the feature is off | schema diff, then `test:basic` |
| Move 9 or 12 widening a slug literal | consumers lose `rime.collection(…)` autocomplete | `check` on **two** fixtures |
| a `$rime/modules` pair broken by a move | 500 on every module request, message names nothing | **the panel in a browser** — no static gate |
| a hook lost | documents with no title, no url | hooks chart identical, `hook-placement.spec.ts` |
| a sed hitting a same-named file in another tree | anything | it happened five times in moves 1–7; `check` caught all five. Grep the full path, never the basename |
