# Coupling audit

Where the three layers still know about each other, measured rather than remembered. Every claim
below is a grep you can re-run.

**Recomputed at `b66a5f3a`.** Counts below are current unless a line says otherwise; the greps
themselves are the contract, not the numbers.

The rule being audited, from `docs/architecture-target.md`:

> Each part of the system is responsible for itself. A prototype does not know what a feature is.

Reading it in both directions gives two questions, and they have very different answers:

| direction                               | state                                                     |
| --------------------------------------- | --------------------------------------------------------- |
| does a **prototype** name a feature?    | clean — a prototype lists features by value, nothing else |
| does **core** name a feature or a kind? | not clean — five distinct clusters below                  |

---

## What is clean

- **The config chain.** `core/config/build.server.ts` is four steps — prototypes, features,
  pipelines, plugins — and names none of them. Each layer folds its own registry, and what each
  contributes to the config's _type_ is declared beside the code that does it
  (`prototype/register.ts`, `features/register.ts`).

  ```ts
  const withPrototypes = configureWithPrototypes(config);
  const withFeatures = configureWithFeatures(prototypes, withPrototypes);
  const withPipelines = resolvePipelines(withFeatures);
  const output = augmentPlugins(withPipelines);
  ```

- **The adapter's vocabulary.** `core/adapter/types.ts` speaks base / shadow / child / branch. The
  grep that started this (`adapter.collection.` / `adapter.area.`) is at 0.
- **The document pipeline.** A prototype declares its own hooks and lists the features that extend
  it; `buildPipeline` merges the two and `resolvePipeline` orders them from declared marks. No
  file knows both a prototype and the features extending it.
- **Feature → prototype.** No feature imports a prototype definition, and the reason changed for
  the better. `configure` used to be _handed_ the registry so a derivation could resolve the
  derived config's pipeline; it now takes only the config, because **pipelines are resolved once,
  after every derivation** (`prototype/pipelines.server.ts`, the third step above). A derived
  collection therefore needs nothing from the prototype at all — it is just another config the
  final fold walks.

  Worth a grep rather than a memory:

  ```bash
  grep -rn "prototype/\(collection\|area\)/definition" \
    src/lib/core/features src/lib/core/pipeline src/lib/core/config
  ```

  Two hits, both in `pipeline/pipeline-order.spec.ts` — a spec asserting the _resolved_ order has
  to reach a real definition, and a spec is not in anyone's import graph. Any hit outside a
  `.spec.ts` is the bug rule 3 describes.

- **Shadow tables.** A feature declares the table it deviates a config's content into
  (`FeatureDefinition.shadow`), `shadowOf` folds it over a prototype's features, and
  `adapter-sqlite/generate-schema` builds the second table from that. It no longer imports the
  versions feature at all.

---

## 1. `versions` is not a feature, it is a dialect

The deepest coupling, and the only one that cannot be moved by relocating files. `versionId`,
`draft` and `versionOperation` are **parameters of the adapter contract** and of the pipeline that
calls it:

```
core/adapter/types.ts                                versionId ×4, draft ×2, versionOperation ×1
core/pipeline/steps/get-original-document.server.ts  8 lines mentioning version/draft
core/pipeline/run.server.ts                          5
core/pipeline/types.ts             imports VersionOperation from features/versions/strategy.js
core/pipeline/persist/{blocks,relations,tree}        each imports contentOwnerSlug
core/constants.ts                  VERSIONS_STATUS, VersionsStatus
core/dev/codegen/routes/common.server.ts             8 lines, the panel's versions pages
```

Consequences worth naming:

- ~~The versions feature declares `type: 'shadow'`, and **nothing reads it**.~~ Fixed for the
  schema: `FeatureDefinition.shadow` names the table, `shadowOf` folds it over a prototype's
  features, and `generate-schema` builds the second table from what it returns — it no longer
  imports `versions/naming.js` at all. The runtime half (`registerPrototype`) still resolves the
  shadow from slug suffixes.
- Its `beforeUpdate` hooks are listed by both prototypes rather than by the feature, because they
  must run for every config — `assertUpsertContext` requires what `defineVersionOperation`
  populates. This is the one place a prototype names a feature, and `features/versions/index.ts`
  says so.
- A config without versions still pays for them in every adapter signature.

**What would decouple it:** `docs/decoupling-versions.md` — the cold-start handoff for exactly this,
with the mechanism mapped, a staged plan, the traps, and the probes that discriminate. Its first
stage is small enough to do in a sitting.

## 2. `upload` leaks through paths and document shape

```
core/prototype/types.ts    UploadDoc, Docs['upload'], Docs['directory'], imports UploadPath
core/prototype/doc.ts      imports isUploadConfig to build a blank document
core/config/types.ts       UploadConfig, image sizes, `upload?: boolean | UploadConfig`
core/prototype/collection/config/augment-panel.ts   reads `config.upload` to pick a dashboard layout
core/prototype/collection/operations/duplicate.ts   4 upload references
adapter-sqlite/prototype.server.ts  imports withDirectoriesSuffix and getSegments
```

The document _shapes_ (`UploadDoc`, the `directory` shape) live in core's prototype vocabulary, so
core knows what an uploaded document is. `augment-panel.ts` reading `config.upload` is the smallest
and most fixable: it is a panel default keyed on a feature.

## 3. `auth` is in the request path and the document shape

```
core/handlers/auth.server.ts   the whole file, plus BETTER_AUTH_ROLES
core/boot.server.ts            imports createAuthInstance directly (step 5)
core/rime.server.ts            RimeAuth on the context
core/prototype/types.ts        GenericAuthDoc, Docs['auth']
core/config/validate.server.ts imports isAuthConfig
adapter/types.ts               imports User from features/auth/types.js
```

`rime.auth` is public API, so the context member is not obviously wrong. `boot.server.ts` naming
`createAuthInstance` while every other feature boots through `bootFeatures` looks like the
inconsistency to fix, and it is **not small**: `FeatureDefinition.boot` takes only the config and
returns nothing, while this one needs the adapter, the config context and the mailer plugin, and
_returns_ the instance that becomes `rime.auth`. Moving it means giving `boot` those arguments and
a way to contribute a member to the context — a contract change, not a relocation.

## 4. `core/config/` still names the two kinds

The chain is clean; the files around it are not.

```
grep -cE 'collections|areas'
  core/config/validate.server.ts   15
  core/config/context.server.ts    13
  core/dev/codegen/types/*          4 across two files
core/config/types.ts   Collection / Area / BuiltCollection / BuiltArea and their config types —
                       `Config` declares `collections` and `areas` as members, so the *authoring*
                       surface names the two kinds by construction
```

**The fold exists now**, in two shapes. A prototype declares the member its instances are authored
under (`PrototypeDefinition.configKey`); `prototypeConfigs(config)` yields every prototype config,
and `prototypeEntries(config)` yields each still paired with the definition that owns it — for the
callers that need something off the definition, such as the features extending it.
`adapter-sqlite/generate-schema` is the worked example: two near-identical loops over `collections`
and `areas` became one over prototype configs, 261 lines to 150. The remaining work is applying the
same fold in the files above, not inventing it.

`validate.server.ts` and `context.server.ts` are the two that iterate `[...collections, ...areas]`
by hand. A third prototype means editing both. The type side (`config/types.ts`) is the bigger
piece: `Config` declares `collections` and `areas` as members, so the _authoring_ surface names the
two kinds by construction.

**What would decouple it:** a prototype declaring its config key and built-config type, the way it
now declares its `configure` — turning both files into folds over the registry. `PrototypeConfigure`
is the precedent and the fold already exists.

## 5. The panel

Untouched by the restructure, and where the remaining `isArea` / `isCollection` greps live:

```bash
grep -rEn "isArea|isCollection|=== 'collection'|=== 'area'|'collections'|'areas'" \
  src/lib --include=*.ts --include=*.svelte
# 72 lines: core 15 · panel 14 · fields 2 · adapter-sqlite 1
```

The adapter's single remaining one is `transform.server.ts:59`, `configCtx.isCollection(slug)`.
Core's 15 are `config/{build,context,types,validate}.server.ts`, four features, two pipeline files,
both definitions, both REST endpoints, `merge-with-blank.server.ts` and `prototype/doc.ts` — items
2–5 of the order below cover most of them.

**The panel is a consumer.** That is the frame this section is missing everywhere else, and it
changes which direction of the coupling is a defect:

- The panel reaching into core and into features — `upload/util/config` (5 imports),
  `upload/naming` (5), `auth/types` (5), `versions/naming` (2) — is a consumer using the API.
  Whether those particular paths should be public is a question about the published surface, not
  about layering.
- Core reaching back into the panel is the inversion — **19 import lines**, and where they are is
  the whole story: `handlers/routes.server.ts` **13**, then one each in `config/types.ts`
  (`DashboardEntry`), `errors/index.ts` (`FormErrors`), `pipeline/steps/validate-fields.server.ts`,
  `plugins/cache/HeaderButton.svelte`, and two in `features/upload/util/path.ts`. Core should not
  know its own admin UI exists.

  ```bash
  grep -rn "from '\$lib/panel/" src/lib/core   # 19
  ```

**And it will not become prototype-agnostic.** Listing many documents and editing the single one an
area holds are genuinely different screens; some `isCollection`-shaped branch survives any amount of
restructuring. The goal is for that branch to be _the panel's own_, made against what a config
declares, rather than core's.

So `core/features/panel/` is, honestly, a filing decision first: somewhere for the panel's config
defaults to live that is not `core/config/`. It is the first step of decoupling the panel and not
much more than that — the real work is the direction above, and it is bounded by what a consumer
is allowed to reach.

---

## Suggested order

Cheapest first, and each is independently useful:

1. **`augment-panel.ts` stops reading `config.upload`.** The collection's panel augment picks a
   dashboard layout from a feature; upload can offer one the way it offers `_titleFallback`. No
   contract change — the only real one-sitting fix on this list.
2. **`FeatureDefinition.validate`**, which moves the auth-collection rules out of
   `config/validate.server.ts`. A small contract addition with one caller.
3. **Features contribute to `createBlankDocument`**, which moves upload's `sizes` out of
   `prototype/doc.ts`. The same shape as 2; `prototype/api.server.ts` already notes the gap.
4. **`validate.server.ts` (15) and `context.server.ts` (13) fold the prototype registry** instead
   of listing `collections` and `areas` — `prototypeConfigs()` and `prototypeEntries()` are there,
   and the schema generator is the worked example.
5. **`Config`'s authoring surface** derives its prototype members from the registry — the type-level
   half of 4, and the one that makes a third prototype cost only its own folder.
6. **Auth's boot goes through `bootFeatures`**, which needs `boot` to take the adapter and context
   and to contribute a member back. Bigger than it looks (see above).
7. **A hook timing meaning "always"**, which lets versions carry its own `beforeUpdate` hooks and
   removes the last prototype→feature naming.
8. **The panel**, largest and last — and the item to read §5 before starting: the work is core
   letting go of `src/lib/panel/`, not the panel letting go of core, and the end state still has a
   collection screen and an area screen.

Item 1 is a sitting. 2–3 are a contract member each. 4–5 are the natural next commit. 6–8 are
projects, and 8 is the biggest thing left in the repo.
