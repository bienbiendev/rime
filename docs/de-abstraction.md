# Composition

## The honest scoreboard

| | develop | this branch |
| - | ------- | ----------- |
| readable | **yes** | no |
| features isolated | no | **partly — and not the ones that mattered** |
| adapter contract | **none at all** | `core/adapter.ts`, 321 lines |

`develop`'s `core/` is `areas/`, `collections/`, `operations/`. There is no `Adapter` interface. A
second adapter is not possible there and cannot be made possible cheaply — the interface is the
thing that took the work, because writing it meant finding every place the database layer knew what
a draft was.

**That is the whole `+?`.** One file, and the seams that had to exist for it to be true.

Everything else this branch added — `FeatureDefinition`'s eleven seams, `fold.ts`, `register.ts`,
`apply.ts` — was built for features that turn out not to be features:

- **auth** — `AuthAdapter` is a member of the `Adapter` interface. `adapter-sqlite/auth.server.ts`
  exists. Already named, everywhere.
- **locale** — named 18 times in the contract, 60 in `prototype.server.ts`.
- **metas** — `updatedAt` and `createdAt` appear 29 times in the adapter, and in `BaseDoc`,
  `sort-document-props.server.ts` and `core/adapter.ts`. `enabled: () => true`. It is not a
  feature; it is what a document is.
- **versions** — the one that *was* hidden, behind `shadow`, in 116 places across ten adapter
  files. The decoupling renamed it rather than removing it.

Four "features" that a CMS cannot be without, wearing a protocol built for optional things. Six of
the ten features declare `enabled: () => true`, which is the same statement in miniature.

## The principle

**Composition, not protocol.** A thing is put together in one place, by name, in a list you can
read — the way `prototype/collection/hooks.server.ts` already works, which is the one change this
month that made something more readable rather than less.

A protocol is the opposite: a definition declares a capability, and something elsewhere discovers
it by folding. Every seam in `FeatureDefinition` is that, and seven of them have one implementer.

## What core may name

- **core:** `auth`, `locale`, `versions`, `metas`. Constitutive. Three of the four already are.
- **the adapter:** the same four. It already names three.
- **nobody:** `upload`, `url`, `title`, `thumbnail`, `nested`, `panel`, `cors`. Seven genuinely
  optional things, which stay in `features/`, reach a prototype by being listed in its composition,
  and never appear in `core/` or `adapter-sqlite/` outside their own folder.

That is the line worth defending, and it is the only one.

---

## Move 1 — say what is core

```
core/auth/        was features/auth       (2016 lines)
core/versions/    was features/versions   (782)
core/metas/       was features/metas      (38) — or folded into prototype/doc.ts
core/locale/      already scattered; gather it

features/         upload url title thumbnail nested panel cors
```

Nothing changes inside the folders. What changes is that core and the adapter may say their names,
which is what unlocks every move below.

**Gate:** `check`, `madge`, generated output byte-identical. It is a move, not an edit.

## Move 2 — delete `FeatureDefinition`

A feature folder exports functions. That is all a feature is.

```
features/upload/
  augment.ts     export const augmentUpload = (config) => …
  hooks/         export const processFileUpload = …
  enabled.ts     export const isUpload = (config) => !!config.upload
```

**Deletes:** `features/define.ts` (295), `features/fold.ts` (202), `features/apply.ts` (34),
`features/tables.ts` (53), `defineFeature`, and the `FeatureConfigure`/`ConfigureTransforms` half of
`register.ts`. `register.ts` keeps `FeatureConfigAugment` (8 declarers) and `FeatureDocTypes` (4) —
those are type-level and they earn it.

**About 600 lines of protocol, gone.**

## Move 3 — compose, by hand, in the prototype

The augment chain becomes a written list, exactly like the hook list:

```ts
// prototype/collection/definition.ts
augments: [
  augmentLabel,
  when(isAuth, augmentAuth),
  augmentPanel,
  when(isUpload, augmentUpload),
  when(isNested, augmentNested),
  augmentVersions,        // self-gates already: `if (versions) {…}`
  when(hasUrl, augmentUrl),
  augmentTitle,
  augmentThumbnail,
  augmentMetas,
  augmentCors
]
```

`when(pred, fn)` is three lines and replaces `FeatureDefinition.enabled` and the `enabled` map in
`buildPipeline`. **Six of the ten features need no gate at all** — they declare `enabled: () =>
true` today.

The order is still column order, still declared once, and now you can see what runs and what
guards it without opening another file. `applyAugments` and its two exported type helpers
(`FeatureNames`, `Augmented`, both already dead) go.

The hook lists get the same treatment where a gate is needed:

```ts
beforeRead: [when(isAuth, removePrivateFields), processDocumentFields, …]
```

**Gate:** generated schema byte-identical — field order is column order, so a mis-ordered list is a
schema diff. Plus `hooks.generated.md` byte-identical and `hook-placement.spec.ts`.

## Move 4 — the adapter says `versions`

`shadow` → `versions` in all 116 places. `ShadowDeclaration` → `VersionsTable`.
`RegisterPrototypeArgs.shadow` → `.versions`. Mechanical, no logic touched, its own commit.

Then in core the three versions seams collapse:

| was | becomes |
| --- | ------- |
| `shadowOf(features, config)` × 5 | `config._versions` — a member, stamped by `augmentVersions` |
| `readQueryOf(features, …)` | `versionsReadQuery(…)`, imported |
| `writePlanWithFeatures(features, …)` | `versionsWritePlan(…)`, imported |
| `WritePlan { data, content }` | `{ base, version }` |
| `ConfigContext.shadowSlugOf` | gone — anyone with the config reads the member |

`versionsReadQuery` is four `if`s. It was always four `if`s; it was a switch in the adapter before
that. The `reduce` around it was the problem.

**Gate:** generated schema byte-identical, then `test:versions` (54 tests), which exercises every
branch.

## Move 5 — stop hand-maintaining better-auth's schema

`core/auth/tables.ts` is 160 lines of column declarations transcribing better-auth's tables —
`$authUsers`, `$authSessions`, `$authAccounts`, `$authVerifications`, `$apikey`. When better-auth
changes its schema, someone diffs their release notes against this file by hand.

It is not better than the template string it replaced. It is further from drizzle and it buys
nothing: no other feature will ever declare tables, so the `TableDeclaration` type exists for this
one caller.

**The fix is to generate it.** Better-auth ships a CLI that emits a drizzle schema for the plugins
you have configured; that output is the thing to consume, and the five tables above stop being
rime's problem.

**Verify before committing to this one** — check what `@better-auth/cli generate` emits for this
plugin set, and whether it can be pointed at the schema file codegen already writes. If it cannot,
the fallback is to keep the declarations but move them beside better-auth's config where the plugin
list already lives, so the two are read together.

`authColumns` stays — `authUserId` and `isSuperAdmin` are rime's columns on rime's table, not
better-auth's.

## Move 6 — the small ones

| what | why |
| ---- | --- |
| `pipeline/steps/` → `pipeline/hooks/` | they are hooks; the list that places them is called `hooks` |
| `ctx.contentQuery(params, intent)` → `versionQuery` | "content row" is the same disguise as "shadow" |
| `ctx.features` | drop it. Three callers, all feeding `writePlanWithFeatures`, which Move 4 deletes |
| `PrototypeApiContext` in `define.ts` | move it beside `prototypeContext`, the function that builds it |
| `PrototypeDefinition.titleFallback` | both prototypes answer `'id'`; `create` seeds it directly |
| `FeatureDefinition.type` / `.requires` | nothing reads either; `requires` documents a check that does not exist |

---

## Order, and why

1. **Move 6's dead fields** — free, proves the seam count was never load-bearing.
2. **Move 1** — the folder move. Nothing works until core may say `versions`.
3. **Move 4's rename** — mechanical, own commit, biggest legibility win per minute.
4. **Move 4's collapse** — the three folds.
5. **Move 3** — the composition lists. Biggest change, best gated (schema + hooks chart).
6. **Move 2** — deleting `FeatureDefinition` is what is *left over* once 3 and 4 are done.
7. **Move 5** — needs its own investigation first.

Each is a commit. None depends on a later one. Stopping after 3 still leaves the adapter saying
what it means.

## The test

When it is done, this reads the system end to end:

1. `core/prototype/collection/definition.ts` — what a collection is, composed in one list.
2. `core/prototype/collection/hooks.server.ts` — what runs, in order.
3. `core/boot.server.ts` — the eight steps that happen once.
4. `core/adapter.ts` — what a database must provide, in words that mean what they say.

Four files. No folds. If a move lands and this needs a fifth, the move was wrong.

## Risk register

| risk | bites | caught by |
| ---- | ----- | --------- |
| a composed list in the wrong order | column order changes → unrequested migration | generated schema byte-identical |
| a `when` guard forgotten | a feature's augment runs on configs without it | schema diff, then `test:basic` |
| the 116-place rename slipping one | a table resolves to the wrong name | generated schema byte-identical |
| a hook lost in the move | documents with no title, no url | `hooks.generated.md` + `hook-placement.spec.ts` |
| Move 2 widening a slug literal | consumer apps lose `rime.collection(…)` autocomplete | `check` on **two** fixtures, `inference.spec.ts` |

The schema gate is headless and takes seconds:

```
rm node_modules/.rime/config.txt && bun ./src/lib/core/dev/cli/index.ts generate --force
```

## What is not on the table

Throwing the branch away. `core/adapter.ts` does not exist on `develop`, and it is the one thing
here that cannot be re-derived in an evening — it took finding every place the database layer knew
what a draft was. Everything else in this plan is deletion.
