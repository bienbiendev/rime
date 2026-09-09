# De-abstraction: the plan

## 1. The finding that settles the adapter question

The adapter contract already names **`locale`** — 18 times in `core/adapter.ts`, 60 times in
`adapter-sqlite/prototype.server.ts`. It already names **`auth`**: `AuthAdapter` is a member of the
`Adapter` interface, and `adapter-sqlite/auth.server.ts` exists.

It hides **`versions`**, and only versions, behind the word `shadow` — **116 times** across ten
adapter files:

```
prototype.server.ts        42      naming.server.ts     6
orderBy.server.ts          23      util.server.ts       4
generate-schema/index      14      transform.server.ts  2
where.server.ts             9      blocks.server.ts     1
generate-schema/root        8      handles.server.ts    7
```

The decoupling did not remove versions from the adapter. **It renamed it.** Every two-table
code path is still there; it just calls the second table "the shadow", and the reader has to learn
a word that means `versions` a hundred per cent of the time.

Three concepts are constitutive of this CMS — auth, locale, versions. Two are named. One is
disguised. That inconsistency is the thing that makes the adapter unreadable, and it is the
argument for the decision below.

## 2. The decision

**Name versions in the adapter.** Not because decoupling was wrong, but because it was applied to
one of three peers and not the other two.

The three options, and why this one:

| option | what it means | verdict |
| ------ | ------------- | ------- |
| **keep `shadow`** | the adapter learns a synonym for versions | 116 mentions of a word that never means anything else |
| **adapter hooks** | features register into `beforeInsert`/`afterRead` | **rejected** — makes the adapter's control flow non-local. It is the hook resolver again, one layer down, and the same failure: a hook that does not fire has no symptom |
| **name it** | `shadow` → `versions`, alongside `locale` and `auth` | consistent with what the adapter already does twice |

**What this costs.** A second adapter must implement versions. It already had to: a second adapter
must implement two-table writes, ordering across two tables, and a where-builder that knows which
column lives where. The cost was never the work, only the word.

**What stays decoupled, and this is the part worth keeping.** The adapter still never asks *a
feature* anything. It is handed facts — `versions: { slug }` at registration, a write split into
base and version, a filter naming which row. `upload`, `url`, `title`, `nested`, `thumbnail`,
`metas`, `panel` and `cors` stay features, stay out of the adapter, and stay out of core's
vocabulary. That is the line that lets a second adapter exist, and nothing below crosses it.

## 3. The census

### `FeatureDefinition` — 11 seams, 725 lines of protocol

`define.ts` 295, `fold.ts` 202, `register.ts` 114, `tables.ts` 53, `apply.ts` 34, `doc-type.ts` 27,
plus 13 `declare module` sites, for ten features.

| seam | implementers | verdict |
| ---- | ------------ | ------- |
| `augment` | auth, metas, thumbnail, nested, title, versions, url, upload | **earns it** |
| `configure` | cors, auth, upload, panel, versions | **earns it** |
| `docType` | versions, upload | thin, keep |
| `blank` | auth, versions | thin, keep |
| `shadow` · `readQuery` · `writePlan` | **versions** | one feature, three seams, three folds |
| `tables` · `columns` · `validate` | **auth** | one feature, three seams, three folds |
| `boot` | **upload** | one feature, one caller, three lines |
| `type` | — | **nothing reads it** |
| `requires` | — | **nothing reads it** |

`requires` is documented as *"`definePrototype` checks this against the order the prototype listed
… a list that contradicts a `requires` fails loudly."* There is no such check. Ten features fill in
`type` and `requires` for no reader.

### `PrototypeDefinition` — 9 fields

| field | readers | verdict |
| ----- | ------- | ------- |
| `name` · `features` · `hooks` · `create` · `boot` · `rest` | 1–27 | keep |
| `singleton` | 1 (boot → `registerPrototype`) | keep — it is the one shape fact the adapter needs |
| `titleFallback` | both prototypes declare `'id'` | **a seam whose two implementers agree** |
| `augments` | one entry each, both a label default | thin |

The prototype layer is in far better shape than the feature layer — one dead-equal field against
seven single-implementer seams. Two prototypes cannot support eleven seams, and it does not try to.

### The `plan` prop

`WritePlan` is `{ data, content?: { id?, data } }` — the base row, and the content row when the
write touches one. The shape is right. **The name is what is opaque**: "plan" says nothing, and
neither does "content". Renamed for what it is, this reads without a comment.

## 4. The rule

CONTRIBUTING says:

> If a feature's name appears in `core/` or in `adapter-sqlite/`, a seam is missing.

Replace it with:

> **Core may name `auth`, `locale` and `versions`.** They are what a CMS is; they are not going to
> be removed, and two of the three were already named. **`adapter-sqlite/` may name them too** —
> it already names two.
>
> **Nothing may name the other eight.** `upload`, `url`, `title`, `thumbnail`, `nested`, `metas`,
> `panel`, `cors` reach core through `augment` and `configure` and reach the adapter not at all.
> If one of their names appears outside its own folder, a seam is missing.

Every stage below lives or dies by that rule.

---

## Stage 0 — delete what nothing reads

`FeatureDefinition.type`, `FeatureDefinition.requires`, and the comment claiming a check that does
not exist. `PrototypeDefinition.titleFallback`, whose two implementers both say `'id'` — `create`
seeds `_titleFallback: 'id'` directly, and the features that override it already do.

**Files:** `features/define.ts`, ten `features/*/index.ts`, `prototype/define.ts`, both
`prototype/*/definition.ts`.
**Gate:** `check` on the same fixture; nothing else can move.
**Size:** ~55 lines deleted. Half an hour.
**Why first:** free, and it is the proof that the seam count was never load-bearing.

## Stage 1 — versions is named, and its three seams collapse into it

The rename and the collapse are one change, because doing either alone leaves a half-state.

**In the adapter:** `shadow` → `versions` in all 116 places, `ShadowDeclaration` →
`VersionsTable`, `RegisterPrototypeArgs.shadow` → `.versions`. A rename, no logic touched. The
diff is large and mechanical; the schema is the gate.

**In core:** the three seams delete.

- `shadow` becomes config data. `versions.augment` already normalises `versions` on a versioned
  config; it also stamps `_versionsTable: { slug: '$pages__versions' }`. Every `shadowOf` caller
  reads a member — which is what keeps the two adapter callers
  (`generate-schema/index.server.ts`, `transform.server.ts`) reading data rather than calling a
  feature. `ConfigContext.shadowSlugOf` and its map go too.
- `readQuery` and `writePlan` become imports. Both are already whole readable functions in their
  own files; `versionsReadQuery` is four `if`s — the switch that used to be in the adapter, in the
  feature that means it. The `reduce` around it was the problem, never the switch.

| caller | was | becomes |
| ------ | --- | ------- |
| `prototype/api.server.ts` | `readQueryOf(features, …)` | `versionsReadQuery(…)` |
| `pipeline/run.server.ts` | `writePlanWithFeatures(features, …)` | `versionsWritePlan(…)` |
| `collection/operations/create.ts` | `writePlanWithFeatures(features, …)` | `versionsWritePlan(…)` |
| `boot.server.ts` · `context.server.ts` · `codegen/types/templates.server.ts` | `shadowOf(features, config)` | `config._versionsTable` |
| `adapter-sqlite/generate-schema` · `transform.server.ts` | `shadowOf(features, config)` | `config._versionsTable` |

**And `WritePlan` gets its name.** `{ data, content }` → `{ base, version }`. The adapter is being
told which rows this write touches; say so.

**Deletes:** `FeatureDefinition.shadow/readQuery/writePlan`, `shadowOf`, `readQueryOf`,
`writePlanWithFeatures`, `ShadowDeclaration`, `ConfigContext.shadowSlugOf`.
**Files:** ~11 in core plus 10 in the adapter, and three specs.
**Gate:** generated schema **byte-identical** — the version tables are in it, so a rename that
slipped shows up as a diff. Then `check`, `vitest`, `madge`, and `test:versions` (54 tests), the
fixture that exercises every branch.
**Size:** ~120 core lines deleted, ~25 added; the adapter rename is mechanical.

**Risk, named:** `_versionsTable` must be stamped before anything reads it — `augment` runs inside
`create()`, the first thing that touches a config, so it is. The derived `$pages__versions`
collection must **not** get one; it declares no `versions`, so `enabled` is false. `test:versions`
proves both.

## Stage 2 — auth's three

`tables` and `columns` have one caller each and it is `adapter-sqlite/generate-schema`. Under the
new rule the adapter *may* name auth — but these two do not need it: they become config data the
way the versions table does. `auth.configure` already derives the `staff` collection, so it states
the tables that config needs; `auth.augment` states the columns. Data beats a name where data is
this easy.

`validate` has one caller, in core. Direct import: `authValidate(config)`.

**Deletes:** `FeatureDefinition.tables/columns/validate`, `tablesOf`, `columnsOf`,
`validateWithFeatures`, `features/tables.ts`.
**Gate:** generated schema byte-identical is the whole gate — all three show up there or in
`check`. Plus `test:basic`.
**Size:** ~90 lines deleted.

## Stage 3 — `boot`

One implementer, one caller, already three inline lines: `await bootUpload(config)`.

**Gate:** `test:basic` — upload's boot makes the static directory, so a break is a 500 on the first
media read.
**Size:** ~15 lines. Fifteen minutes.

## Stage 4 — write down why the survivors survive

`augment` (8 implementers), `configure` (5), `blank` (2), `docType` (2). No deletes. `define.ts`
loses two thirds of its length with the seams, and what is left gets one honest paragraph each
instead of an essay — including why `docTypeWithFeatures` keeps its ANDed `fields` predicates
(upload's image sizes must filter fields that versions' contribution must not un-filter).

## Stage 5 — `ConfigureTransforms` (optional, last, skippable)

`features/register.ts` keeps `FeatureConfigAugment` (8 features) and `FeatureDocTypes` (4). The
third target — `FeatureConfigure` + `ConfigureTransforms = ['panel', 'cors']` +
`ApplyFeatureConfigure` — is the merging seam already deleted for prototypes, for two features.

**Load-bearing for generic-`T` deferral:** `bootRime<C>` reads `config.panel.language` while `C` is
a type parameter. Replacing it means `BuiltConfig` naming `panel` and `$trustedOrigins`, measured
against `check` on **two** fixtures. If `check` moves by one, revert and leave it.

---

## The deliverable: reading this repo in fifteen minutes

The point of the plan, so it is checkable rather than a feeling. When it is done, this path
explains the system end to end and nothing on it is a fold you have to decode:

1. `core/prototype/index.ts` — two exports, `collection` and `area`.
2. `core/prototype/collection/definition.ts` — what a collection is: its features, in order.
3. `core/prototype/collection/hooks.server.ts` — what runs on a read, a create, an update.
4. `core/features/define.ts` — the four things a feature may do.
5. `core/boot.server.ts` — the eight numbered steps that happen once.
6. `core/adapter.ts` — what a database has to provide, in words that mean what they say.

If a stage lands and that list needs a seventh entry, the stage was wrong.

## Risk register

| risk | where it bites | what catches it |
| ---- | -------------- | --------------- |
| the 116-place rename slipping one | a table resolves to the wrong name | generated schema byte-identical |
| `_versionsTable` read before it is stamped | versioned reads return the wrong row | `test:versions`, 54 tests |
| the derived versions collection getting its own | recursive table names in the schema | generated schema byte-identical |
| auth's tables/columns as config data | `staff` or `auth_users` missing | generated schema byte-identical |
| Stage 5 widening a slug literal | consumer apps lose `rime.collection(...)` autocomplete | `check` on **two** fixtures, `config/inference.spec.ts` |
| any of it dropping a hook | documents come back with no title, no url | `hooks.generated.md` byte-identical, `hook-placement.spec.ts` |

The schema gate is the one that matters in Stages 1–3 and it is cheap, headless, and takes seconds:

```
rm node_modules/.rime/config.txt && bun ./src/lib/core/dev/cli/index.ts generate --force
```

then diff. No dev server.

## The escape hatch

One commit per stage, each independently revertable, no stage depending on a later one. Stage 1's
adapter rename is committed separately from Stage 1's core deletes, so the mechanical half can be
kept even if the collapse is rejected.

Stopping early still wins: Stage 0 alone removes three dead fields from every definition in the
repo, and Stage 1's rename alone makes the adapter say what it does.

## What this is not

Not a rewrite, and not a retreat from the decoupling. The adapter contract, the feature folders,
the hook lists, `augment` and `configure` stay. Eight of the ten features remain fully isolated and
unnameable outside their folders.

What goes is the machinery that let core avoid saying `versions` out loud — while the adapter said
`locale` and `auth` on every other line.
