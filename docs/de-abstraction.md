# De-abstraction: the plan

## The diagnosis, in numbers

`core/features/` holds **725 lines of protocol** — `define.ts` 295, `fold.ts` 202, `register.ts`
114, `tables.ts` 53, `apply.ts` 34, `doc-type.ts` 27 — plus 13 `declare module` sites, to coordinate
ten features. Here is what actually uses it:

| seam | implementers | verdict |
| ---- | ------------ | ------- |
| `augment` | auth, metas, thumbnail, nested, title, versions, url, upload | **earns it** |
| `configure` | cors, auth, upload, panel, versions | **earns it** |
| `docType` | versions, upload | thin, keep |
| `blank` | auth, versions | thin, keep |
| `shadow` | versions | one feature |
| `readQuery` | versions | one feature |
| `writePlan` | versions | one feature |
| `tables` | auth | one feature |
| `columns` | auth | one feature |
| `validate` | auth | one feature |
| `boot` | upload | one feature |
| `type` | — | **nothing reads it** |
| `requires` | — | **nothing reads it** |

Seven seams have one implementer. Two are read by nothing at all — `requires` is documented as
"`definePrototype` checks this against the order the prototype listed"; it does not, and never has.
Ten features fill both in for no reader.

Each of the seven is reached through its own `reduce` over ten features, asking each one politely
whether it would like to answer, when only one ever will.

## The rule that has to change

CONTRIBUTING says:

> If a feature's name appears in `core/` or in `adapter-sqlite/`, a seam is missing.

**Halve it.** Only `adapter-sqlite/` must not name a feature. That is what lets a second adapter
exist and it is the part that cost 206 commits; it is not what is being undone here. Core naming
`versions` is fine — core already names `auth.removePrivateFields` in
`prototype/collection/hooks.server.ts`, and writing that list out by hand is the change that made
the pipeline readable.

Every seam below lives or dies by that halved rule and nothing else. A seam survives when its
caller is in `adapter-sqlite/`, or when several features answer it.

## The end state

```
core/features/
  define.ts     ~110   name, enabled, augment, configure, blank, docType
  fold.ts        ~55   applyAugments, configureWithFeatures, blankWithFeatures, docTypeWithFeatures
  register.ts    ~85   FeatureConfigAugment (8 features), FeatureDocTypes (4)
  <feature>/           unchanged — auth 2016, upload 1710, versions 782, …
```

725 lines of protocol → about 310. Four folds, each folding something several features answer.
What a feature needs that no other feature will ever need, it puts on the config, or core imports
from it by name.

---

## Stage 0 — delete what nothing reads

`FeatureDefinition.type` and `FeatureDefinition.requires`, and the twenty lines of comment
explaining them, and the ten features that fill them in.

**Files:** `features/define.ts`, ten `features/*/index.ts`.
**Gate:** `check` on the same fixture. Nothing else can move.
**Size:** ~40 lines deleted. Half an hour.

This one first because it is free, and because it is the proof that the seam count was never
load-bearing.

## Stage 1 — versions' three seams become one fact

`shadow`, `readQuery` and `writePlan` are the same statement three times: *this config's content
lives in a second table*. Whoever owns that table owns picking a row from it and splitting a write
across it. They cannot be answered by different features, and never have been.

**The shadow becomes config data.** `versions.augment` already normalises `versions` on a versioned
config; it also stamps

```ts
_shadow: { slug: '$pages__versions' }
```

Then every `shadowOf` caller reads a member. That is what makes this stage possible at all: two of
those callers are `adapter-sqlite/generate-schema` and `adapter-sqlite/transform.server.ts`, and
reading a config member keeps them naming no feature.

`config/context.server.ts`'s `shadowSlugs` map and `shadowSlugOf` accessor go with it — anyone
holding a config reads `config._shadow?.slug`.

**The two functions go home.** `readQueryOf` and `writePlanWithFeatures` delete; their callers
import from `versions`:

| caller | imports |
| ------ | ------- |
| `prototype/api.server.ts` (`contentQuery`) | `versionsReadQuery` |
| `pipeline/run.server.ts` | `versionsWritePlan` |
| `prototype/collection/operations/create.ts` | `versionsWritePlan` |

Both are already whole readable functions in their own files. `versionsReadQuery` is four `if`s —
the switch that used to live in the adapter, in the feature that means it. That part was never the
problem; the `reduce` around it was.

**Deletes:** `FeatureDefinition.shadow/readQuery/writePlan`, `shadowOf`, `readQueryOf`,
`writePlanWithFeatures`, `ShadowDeclaration`, `ConfigContext.shadowSlugOf`.
**Files:** 11 — define.ts, fold.ts, versions/augment.ts, versions/index.ts, boot.server.ts,
config/context.server.ts, prototype/api.server.ts, pipeline/run.server.ts,
collection/operations/create.ts, adapter-sqlite/generate-schema/index.server.ts,
adapter-sqlite/transform.server.ts. Plus three specs.
**Gate:** generated schema **byte-identical** (the shadow tables are in it), `check`, `vitest`,
`madge`, `test:versions` e2e — the fixture that exercises every branch of this.
**Size:** ~120 lines deleted, ~25 added. The biggest stage.

**Risk, named:** `_shadow` must be stamped before anything reads it. `augment` runs inside
`create()`, which is the first thing that touches a config, so it is. The derived
`$pages__versions` collection must *not* get one — it declares no `versions`, so `enabled` is false
and it does not. `test:versions` proves both.

## Stage 2 — auth's three

`tables` and `columns` have exactly one caller each and it is `adapter-sqlite/generate-schema`. So
these cannot become imports — that would put `auth` in the adapter. They become config data, the
way the shadow does: `auth.configure` already derives the `staff` collection, so it also states the
tables that config needs; `auth.augment` states the columns.

`validate` has one caller and it is `config/validate.server.ts`, in core. Direct import:
`authValidate(config)`.

**Deletes:** `FeatureDefinition.tables/columns/validate`, `tablesOf`, `columnsOf`,
`validateWithFeatures`, `features/tables.ts` (53 lines).
**Files:** 7. Plus two specs.
**Gate:** generated schema byte-identical is the whole gate — every one of these three shows up in
it or in `check`. Plus `test:basic`, the fixture with auth collections and API keys.
**Size:** ~90 lines deleted.

## Stage 3 — `boot`

One implementer, one caller, three lines inline in `boot.server.ts` already:

```ts
await bootUpload(config);
```

**Deletes:** `FeatureDefinition.boot`, the loop.
**Gate:** `test:basic` — upload's boot creates the static directory, so a break is a 500 on the
first media read.
**Size:** ~15 lines. Fifteen minutes.

## Stage 4 — the two that stay, stated as such

`blank` (auth, versions) and `docType` (versions, upload) keep their folds. Two implementers is
thin but real, and both fold *contributions* rather than picking a winner — there is no "first
answer wins" to collapse.

`docTypeWithFeatures` keeps its ugliest line, the ANDed `fields` predicates, because upload's image
sizes genuinely have to filter fields that versions' contribution must not un-filter. It gets a
comment saying that in one sentence instead of three.

**No deletes.** This stage is writing down why the survivors survive, so the next person does not
have to re-derive it.

## Stage 5 — `ConfigureTransforms` (optional, last)

`features/register.ts` keeps `FeatureConfigAugment` (8 features) and `FeatureDocTypes` (4) — those
earn their keep. The third target, `FeatureConfigure` + `ConfigureTransforms = ['panel', 'cors']` +
`ApplyFeatureConfigure`, is the same declaration-merging seam already deleted for prototypes, for
two features.

**Riskier than it looks.** It is load-bearing for generic-`T` deferral: `bootRime<C>` reads
`config.panel.language` while `C` is still a type parameter, and an intersection built from a key
union stays deferred there. Replacing it means `BuiltConfig` naming `panel` and `$trustedOrigins`
directly, which is fine, and `configureWithFeatures` returning `T` — which has to be measured
against `check` on two fixtures, not one.

**Skippable.** Nothing above depends on it. If `check` moves by even one, revert and leave it.

---

## The deliverable: reading this repo in fifteen minutes

That is the point of the whole plan, so it is a checkable outcome, not a feeling. When it is done,
this path explains the system end to end and nothing on it is a fold you have to decode:

1. `core/prototype/index.ts` — two exports, `collection` and `area`.
2. `core/prototype/collection/definition.ts` — what a collection is: its features, in order.
3. `core/prototype/collection/hooks.server.ts` — what runs on a read, a create, an update, written
   out in order.
4. `core/features/define.ts` — the six things a feature may do.
5. `core/boot.server.ts` — the eight numbered steps that happen once.
6. `core/adapter.ts` — what a database has to provide.

If a stage lands and that list still needs a seventh entry to make sense, the stage was wrong.

## Risk register

| risk | where it bites | what catches it |
| ---- | -------------- | --------------- |
| `_shadow` read before it is stamped | versioned reads return the wrong row | `test:versions`, 54 tests |
| a derived shadow config getting its own `_shadow` | infinite table names in the schema | generated schema byte-identical |
| auth's tables/columns moving to config data | `staff` or `auth_users` missing from the schema | generated schema byte-identical |
| Stage 5 widening a slug literal | every `rime.collection(...)` in consumer apps loses autocomplete | `check` count on **two** fixtures, `config/inference.spec.ts` |
| any of it silently dropping a hook | documents come back with no title or no url | `hooks.generated.md` byte-identical, `hook-placement.spec.ts` |

The generated schema is the gate that matters in Stages 1–3, and it is cheap: `rm
node_modules/.rime/config.txt && bun ./src/lib/core/dev/cli/index.ts generate --force`, then diff.
It runs headless, in seconds, with no dev server.

## The escape hatch

One commit per stage. Each independently revertable. No stage depends on a later one, and Stage 0
depends on nothing.

If a stage lands and the code reads *worse* than what it replaced — revert that commit and stop
there. The stages are ordered so that stopping early still leaves the repo better than it is now:
Stage 0 alone removes two dead required fields from every feature, and Stage 1 alone removes the
three folds that started this.

## What this is not

Not a rewrite. Not a retreat from the decoupling. The adapter contract, the feature folders, the
hook lists, `augment` and `configure` all stay exactly as they are. What goes is the machinery that
let core avoid saying `versions` out loud — and one thing that was never read at all.
