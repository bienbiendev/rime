# Restructure handoff

Working notes for whoever picks this up next — most likely me, with none of the context. The
north star is `docs/architecture-target.md`; this file records where the work has actually got to,
what is left, and the handful of rules that were expensive to learn and are easy to break again.

> **Start at `docs/cold-start.md`.** It is the map: current state, the ordered backlog, and which
> document answers what. This file is the _history and the rules_ — the Done table with commits,
> and the five things that cost a round each. **`docs/probing.md`** is how to verify anything
> without the e2e suite; it supersedes the "Live probes" section below.

Branch: `claude/restructure-handoff-docs-vnq2pq` (was `claude/repo-structure-audit-89hs4d`).

---

## The idea, in three lines

| layer         | verb                   | scale                                                |
| ------------- | ---------------------- | ---------------------------------------------------- |
| **prototype** | _defines_              | the base thing itself                                |
| **feature**   | _augments and extends_ | large — across prototypes, adds shadows and children |
| **plugin**    | _augments_             | small                                                |

`collection` and `area` are two definitions built to the same pattern, not one implementation with
a `singleton` discriminator. Each brings its own surface: local API, operations, REST, config
factory, hooks. The adapter knows `base / shadow / child / branch` and nothing about kinds.

**The whole point, stated the way it kept having to be restated: each part of the system is
responsible for itself. A prototype does not know what a feature is.** If a prototype file ever
names `upload` again, something has gone backwards.

---

## Done

| #        | commit                | what                                                                                                                                       |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | `9ed1e9d`             | adapter speaks base/shadow/child/branch; `adapter.{collection,area}` deleted                                                               |
| 2        | `675fc77`             | definitions own their local API and operations                                                                                             |
| 3        | `2a8c015`             | definitions own their REST; codegen reads the registry; `core/rest/` deleted                                                               |
| 4        | `f7c49f4`             | the feature contract, with `url` as its first inhabitant                                                                                   |
| 5        | `1f8e759`             | `upload`, `nested`, `versions`' augment become features                                                                                    |
| 6        | `0fa7f49`             | `$rime/modules` resolves per name instead of through a whole-package barrel                                                                |
| 7        | `e3ea8f8`             | definitions own their config factory and their pipeline                                                                                    |
| 8        | `fd621f2`             | hooks declare `requires`/`provides`; the order is **resolved**, not written                                                                |
| 8h       | `f21fc07`             | `hooks.generated.md` renders as a tree, tagged by contributing feature                                                                     |
| 9b/9c    | `ceefc6e`             | `factory/shared` becomes features; the registry stops naming features in its types                                                         |
| 9-pre/9a | `28143da`             | `Rime` is declared, not inferred; the prototype declares `features` and `hooks`; **both `pipeline.server.ts` files deleted**               |
| 10a      | `2a9cb4a`             | a prototype declares its own whole-config `configure`; `augmentPrototypes` deleted                                                         |
| 10c      | `f3ead15`             | one plugin step for both sides; the double `augmentPlugins` call (and its three header buttons) gone                                       |
| 10d      | `a54a774`             | the three panel augments move to `core/features/panel/`                                                                                    |
| 10       | `4fd4204`             | **`factory/` → `core/config/`, `operations/` → `core/pipeline/`**, `hooks.ts` with them                                                    |
| 10b      | `1db951b`             | three feature-owned hooks leave `pipeline/steps/` for their features                                                                       |
| 10b′     | `9990967`             | `mergeWithBlankDocument` goes to the collection — same rule, applied properly                                                              |
| 11       | `f7d751c`             | **a feature's `configure` can refine the config's type**; auth, panel and versions own their config steps; the chain stops naming features |
| 11b      | `c786f48` → `6e50592` | CORS becomes a **feature**, augment and handler together; `FeatureDefinition` gains `handler`                                              |
| 12       | `a1dc53cc`            | the prototype declares `titleFallback`; features override it as `_titleFallback`, off the authoring surface                                |
| 12b      | `5ebdcee2`            | upload's directories derivation takes the collection's features from the registry — **no feature imports a prototype definition**          |
| —        | `6a9a81ba`            | comment pass: what the code does, not what it replaced                                                                                     |
| 13       | `8d5500fe`            | base-row fields come from the `._root()` flag, not a name list                                                                             |
| 13b      | `20a3b815`            | a versions shadow gets its own pipeline instead of the parent's                                                                            |
| 14       | `b66a5f3`             | **the shadow table is declared by the feature that owns it**; the schema generator stops reading `config.versions`                         |
| 9r       | _this commit_         | **`augment` moves onto `definePrototype`**; `prototype/*/config/` is gone and `create` is composed once                                    |

Structural greps (`docs/architecture-target.md`'s own test):

```
adapter.collection. / adapter.area.   13 -> 0   ✓
isArea|isCollection|type === '...'    65 -> 59  ✓ (still 59 after commit 10)
```

The 59 that remain are the panel (about half), the two `rest/endpoint.server.ts` files, and
`config/{validate,context}.server.ts`. None of them is the adapter or the pipeline, which is what
the greps were for.

### Commit 9's remainder, as it landed

A prototype's config factory was four files — `prototype/{collection,area}/config/index.ts` and
`index.server.ts` — each spelling out the same chain: seed `_titleFallback`, run the prototype's own
augments, run the features', then shape the result. It is now two props and one composition:

- **`augments`** on the definition. The collection lists `augmentLabel` and `augmentPanel`; the area
  lists `augmentAreaLabel`, which is the `label ?? capitalize(slug)` line its factory used to carry
  inline. Both files moved up beside the definition, and `config/` is gone.
- **`create`, composed by `definePrototype`** and never passed in. The shaping the four files did
  identically — `kebab`, `type`, the `fields` / `icon` / `live` fallbacks and the staff-only access
  defaults — is stated once, for every prototype.
- **`name`** on the definition, because `create` stamps `config.type` and that is the name. It was
  synthesised from the registry key before; `RegisteredPrototype` is now an alias rather than a
  definition plus a name, and both registries hand back the definitions themselves.

Two consequences worth stating:

- **The client and server factories collapsed into one.** They differed only in listing their
  members by hand versus spreading them, and `BuiltCollectionClient = BuiltCollection` already said
  the two shapes are the same. Measured, the client config now carries three things more:
  `_titleFallback`, `$url` (which `sanitize` strips before the client config is generated, so it
  never actually appears there), and `panel.dashboard` — the defaults `augmentPanel` computes and
  the old client factory then threw away by returning `incomingConfig.panel`. The dashboard is built
  in a **server** load, so nothing read the discarded ones.
- **The `as const` feature tuple is gone.** `collectionFeatures` / `areaFeatures` existed so
  `applyAugments` could fold the feature names into the factory's return type. `create` declares its
  return type (rule 1), so the fold had nothing left to do and the order is stated exactly once,
  inline in `features`.

`create` stays public authoring API — `Collection.create('pages', {…})` — as a one-line typed
re-export beside each definition. That is the one thing a definition prop cannot state: the
authoring type is generic in the slug (`Collection<S>` types `$hooks` and `$url` from it) and no
type parameter can carry a generic type.

---

## Rules that cost a round each — break these and you get silent breakage

### 1. Anything reachable from `Rime`'s type graph must **declare** its type, never infer it

`Rime` used to be `Awaited<ReturnType<typeof createRime>>`. Every hook is typed through
`HookContext → event: RequestEvent → App.Locals → rime`, so the moment a definition in
`createRime`'s value graph carried hooks, each hook referenced itself and TypeScript answered
`any`. **One inferred alias, three symptoms**: inline `$hooks` in a `defineConfig` broke, commit
2's accessors resolved to `never`, and a prototype could not carry its own hooks (100 errors).

`Rime` and `RimeContext` are declared in `core/rime.server.ts` now. The rule that falls out:

> Take types from **declared config phantoms** (`BuildConfig<C>['$InferPluginsServer']`,
> `RimeAuth<C>`), never from `createRime` or `bootRime`. A phantom is declared _about_ a config,
> so naming it costs nothing. Naming a function that imports the prototype registry puts every
> hook back in the loop.

Four places currently hold that line — if a self-reference cascade returns, check these first:

- `core/rime.server.ts` — `Rime` / `RimeContext` declared.
- `core/prototype/registry.ts` — `prototypes: RegisteredPrototype[]` **annotated**. Inferring it
  makes `BuildConfig` depend on every feature's hooks.
- `core/prototype/accessors.server.ts` — accessors read from `api.server.ts`, which imports no
  hooks, rather than off each definition's `$InferAccessor`.
- `core/features/auth/better-auth/instance.server.ts` — `RimeAuth` lives here so its _type_ can be
  named without naming `bootRime`.

The cost is real and one-directional: `Rime` is hand-maintained, and a member added to
`createRime` without adding it to the interface is invisible to consumers. `satisfies` catches
only the opposite mistake.

### 2. Field order is column order

The config factories fix the order in which augments append fields, and that is the order of the
columns in the generated schema. **Never reorder an augment chain or a `features` list casually.**
The gate is the golden schema diff (below), and it is the only thing that catches it.

### 3. A feature must not import a prototype's _server_ definition

`collection/definition.ts` imports every feature (it lists them), so a feature importing the
definition back closes a module cycle. That is survivable when the back-edge is read inside a
function — but `definition.server.ts` spreads `{ ...base }` **at module scope**, so if
`definition.ts` is entered first the spread sees an uninitialized binding and the definition
silently loses `features`/`hooks`.

This is why `core/prototype/collection/hooks.server.ts` exists as its own file: a list of hooks
depends on nothing, so a feature deriving a collection (`upload/directories`, `versions/derive`)
can import it from anywhere.

**The features list is the other half, and it cannot be filed the same way** — it contains the
features themselves, so any file reaching it from inside a feature can be entered while that
feature is still evaluating, and the definition's array literal then captures `undefined` for it.
`versions/derive.server.ts` imported `collectionPrototype.features` for years without incident,
because only `build.server.ts` reached it. The moment that call became the versions feature's own
`configure`, the path became `area/definition.ts → versions/index.ts → derive.server.ts →
collection/definition.ts` — and `collectionFeatures` came out as
`[auth, panel, upload, nested, UNDEFINED, url, …]`, with a `Cannot read properties of undefined
(reading 'augment')` a long way from the cause.

So: **`FeatureDefinition.configure` takes the prototypes as an argument.** A feature that needs a
prototype's `features` or `hooks` gets them from the registry the caller hands over, and imports no
definition at all.

**The same edge, from the other side, is worse.** Both config factories used to read the prototype
off `definition.server.ts` just to hand `{ features, hooks }` to `augmentHooks`. Adding one feature
to a prototype's list was enough to reorder the graph so that the `{ ...base }` spread ran early,
and the definition came out **without `features`** — so every feature hook stopped running while
the prototype's own kept going. Documents came back with no `title` and no `url`, and:

> `bun run check`, `eslint`, `madge`, the unit suite, the generated schema **and the generated
> hooks chart** were all byte-identical to baseline. The chart is built from the config, not from
> what boots. Only a live read caught it.

`create` now takes `{ features, hooks }` from `definition.ts` and `hooks.server.ts` — the two files
that depend on nothing — and the area's hooks moved into their own file to make that possible.
`prototype/collection/pipeline.spec.ts` builds a real collection and asserts both layers are in its
pipeline, which fails if this regresses. The rule outlived the two factories: `auth`'s `augmentStaff`
still imports `collection/definition.js`, never `definition.server.js`.

### 4. A mark nothing active provides is satisfied (the vacuous rule)

`requires: ['x']` means _after **every** active provider of `x`_ — and if nothing active provides
it, the requirement is met. That is what lets one declaration be correct in both `beforeCreate`
and `beforeUpdate`, and what keeps a feature's mark from breaking configs without that feature.

Consequences worth remembering:

- `HookMark` is a **closed union** (`core/pipeline/types.ts`) extended by features through
  declaration merging. It must stay closed: a typo'd mark is _vacuously satisfied_ and reorders
  the pipeline silently — the one failure mode of this design that raises no error at all.
- Marks that both require and provide `document` cannot require `document` of each other without
  closing a cycle. When a real ordering is needed between two such hooks, name the specific thing
  (`populateURL` requires `title`), not the generic one.
- `data-inspected` is the write-side twin of `sanitized`: the auth `beforeUpdate` guards provide
  it and `buildDataConfigMap` requires it. It exists because `preventUserMutations` rejects on
  `'name' in args.data` — run it after `setDefaultValues` and a filled default 401s every user
  update.

### 5. Re-measure baselines on the _same fixture_

`rime:use <fixture>` swaps the active fixture and it changes the `bun run check` count. A
post-change measurement compared against a baseline taken on a different fixture reads as a
regression that is not there. This has happened; it cost a round.

### 6. Whole-config steps belong to whoever owns them

The chain was a list of feature-owned calls (`augmentStaffServer`, `augmentIcons`, `augmentPanel`,
`augmentPanelAccess`, `augmentCORS`, `makeVersionsCollectionsAliases`) for one reason: a whole-config
step that **refines the config's type** could not go through `configureWithFeatures`, which returned
`T`. Commit 11 removed that reason. Both layers now have the declaration-merging device:

| layer     | declares in                                       | folded by                 |
| --------- | ------------------------------------------------- | ------------------------- |
| prototype | `prototype/register.ts` — `PrototypeConfigure<T>` | `configureWithPrototypes` |
| feature   | `features/register.ts` — `FeatureConfigure<T>`    | `configureWithFeatures`   |

So the server chain is three lines — prototypes, features, plugins — and **nothing in
`core/config/` names a feature**. Adding a whole-config step means adding `configure` to whoever
owns it, plus a `declare module` if it changes the type. Three rules fell out:

1. **The fold's order is a hand-written tuple** (`configureOrder` in `features/registry.ts`), because
   the type cannot read the order back off the annotated registry (rule 1). `registry.spec.ts`
   asserts it against what actually runs, so drift fails a test instead of silently mistyping.
2. **A `configure` is handed the prototypes; it must never import one.** See rule 3 below — this is
   where that rule stopped being theoretical.
3. **A default with exactly one reader does not need a config step at all.** `panel.$access` and
   `$trustedOrigins` were each a whole step — server-only, type-refining — for a member one line
   read. Both are now `??` at that line, and both steps are deleted rather than moved. Check this
   before writing a `configure`: `grep` the member, and if there is one consumer, stop.

The chain is still a literal sequence rather than a loop, and `config/inference.spec.ts` guards
that: a reduce over an array of augments widens every slug literal to `string`.

### 7. A feature's `index.ts` must not import its own `.server.ts` hooks

Rule 3's other half, and it cost the whole panel. A prototype's `features` list is reachable from a
**client** build — `create` runs the augments on both sides — so every feature `index.ts` is
isomorphic, and a hook it imports by path travels with it into the browser graph. `auth`, `title`
and `thumbnail` did exactly that; `nested`, `url` and `upload` did not.

The panel never loaded. Every module request 500'd with:

```
Error: An impossible situation occurred    (@sveltejs/kit/src/exports/vite/index.js:798)
```

which is SvelteKit's server-only guard **firing correctly** and then failing to explain itself: it
walks the importer chain to print a "Cannot import X into code that runs in the browser" pyramid,
follows `candidates[0]` — one arbitrary branch — and throws that fallback when the branch dead-ends
before a route entrypoint. The message names nothing. **The 500'd request URLs name everything**;
see `probing.md` §7.

The fix is the convention that already existed: a `hooks/module.server.ts` with **no `module.ts`
beside it**, imported as a name from `$rime/modules`. Only a module with no client half gets its
names stubbed to `undefined` on a client build — a pair with both halves exports the client half's
names and a server-only name is simply _missing_ there (`rime-modules-resolution.md`, cases B and
C). So `hooks: authHooks` is a real object on the server and `undefined` in the browser, and
`defineFeature` already treats a missing `hooks` as none.

Nothing static sees this. `check`, `eslint`, `madge`, the unit suite and the generated schema are
all identical either way — `.server.ts` resolves perfectly well to a type-checker. **Load the panel
in a browser** before believing a green run that touched a feature's imports.

---

## Gates, and what they are for

Run against the base commit's **own** numbers, re-measured, not trusted from any doc.

| gate            | command                                                        | note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| types           | `bun run check`                                                | **13 on `basic`**, **0 on `versions`**, **6 on `versions-multilang`** (that fixture's own `src/routes/(front)/` pages, verified pre-existing by stash-and-rerun): the 6 pre-existing `src/lib` ones (`collection/operations/create.ts` ×4, `duplicate.ts`, `features/thumbnail/hooks/set-document-thumbnail.server.ts` — all `DeepPartial` / union-narrowing in generated-type land) plus 7 in the fixture's own `src/routes/(front)/` pages. Count what the run prints, not what a doc says |
| lint            | `bunx eslint src/lib`                                          | 21; the rest are pre-existing panel `goto()`/`href` and two unused `toKebabCase`                                                                                                                                                                                                                                                                                                                                                                                                             |
| cycles          | `bun run check:circular-deps`                                  | 3 since commit 11 (both `staff` cycles went with it), and the _list_ matters more than the count                                                                                                                                                                                                                                                                                                                                                                                             |
| unit            | `bunx vitest run`                                              | 124                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| pipeline layers | `collection/pipeline.spec.ts`                                  | **the gate for rule 3** — a definition that lost its `features` is green everywhere else                                                                                                                                                                                                                                                                                                                                                                                                     |
| schema          | diff the generated `schema.server.ts` against a golden capture | **the gate for rule 2**                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| pipeline order  | `core/pipeline/pipeline-order.spec.ts`                         | **the gate for rule 4** — a wrong mark is schema-identical and probe-identical                                                                                                                                                                                                                                                                                                                                                                                                               |
| e2e             | `bun run test`                                                 | expect 375                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**Capture a golden schema before touching any augment chain.** Boot the dev server on a fixture,
copy `src/lib/+rime.generated/schema.server.ts` somewhere outside the repo, make the change, boot
again, diff. It is generated, gitignored, and cheap to lose.

### Live probes

**Moved to `docs/probing.md`**, expanded: the request shapes, the versions flow in five calls,
what each probe discriminates, the golden-schema capture loop, the hooks chart as a diagnostic,
the stash-and-rerun technique for proving a defect pre-existing, and the traps — `curl` needs
`-g` for any `where[...]` filter, a list endpoint hides drafts, `PATCH` with no `versionId`
targets the published version.

### Booting is a gate of its own

Three of the six bugs in `28143da` were invisible to every static check and only appeared on
`bun run dev`: duplicate fields rejected at validation, areas 404ing because boot iterated the
wrong registry, and a definition that had silently lost its hooks. **Boot the server and hit an
area and a collection before believing a green check.**

---

## What is left

> **The ordered backlog lives in `docs/cold-start.md` §4** — ten items, cheapest first, each with
> the document behind it. `docs/coupling-audit.md` is the measured version: every place core still
> names a feature or a kind, with the greps to re-run. `docs/decoupling-versions.md` is the staged
> plan for the deepest of them, with the code beside each step.

### The panel

`core/features/panel/` is a real feature now — icons and the navigation/language/component
defaults, listed by both prototypes before `upload` and `versions` so the icon map keeps excluding
derived collections. The panel _itself_ (`src/lib/panel/`) is still untouched, and is where most of
the remaining `isArea` / `isCollection` hits live.

### Known loose ends

- **`hooks.generated.md` is not regenerated on a normal boot.** It needs
  `RIME_GENERATE_HOOKS_CHART=true`, it writes to the repo root, and `rime:use` deletes it. It is
  committed from the **`basic`** fixture — regenerate it there, or its diff becomes a fixture swap
  instead of a real order diff. Codegen also memoises: `rm node_modules/.rime/config.txt` to force
  a run.
- `$rime/modules` warns on boot that `core/plugins/cache` exports `toHash` from its server half
  only. Legal and intentional; the warning exists so an asymmetry that _does_ break shows up.
- **`collectionHooks` imports two `versions` hooks by name** — `defineVersionOperation` and
  `handleNewVersion`, in `beforeUpdate`. The one place a prototype still names a feature, and it is
  deliberate: those two run for _every_ config, versioned or not (`assertUpsertContext` requires
  what the first one populates), so `enabled` would break updates on non-versioned configs.
  `features/versions/index.ts` states it, and states the fix: a timing that says "always".
- `pipeline/steps/` is now only what **both** prototypes' hook lists import. A step used by one
  feature or one prototype belongs to it, whatever the file count — "a folder for one file is
  ceremony" is not a reason, and `merge-with-blank.server.ts` cost a round proving it.

---

## Environment

### A fresh container starts from nothing

`node_modules/`, `.env` and the active fixture are all gitignored, so a new container has none of
them and every gate reads as catastrophically broken until they are back:

```bash
bun install
# .env is NOT in the repo. `rime init` writes one, but with the *consumer* default
# RIME_CONFIG_DIR=src/+rime — and this repo's fixtures land in src/lib/+rime, so init then
# generates a default starter config that imports 'rimecms/adapter-sqlite' and dies. Write the
# file first (CONTRIBUTING.md has it in full), or fix the line and delete src/+rime{,.generated}.
bun run rime:use basic
```

Before that is done, `bun run check` reports ~200 errors — no generated types, no routes, no
config. That is the fixture missing, not a regression.

### The two that must be redone after any container restart

- **SMTP sink** on `127.0.0.1:1025`, implicit TLS. **Verify it with a real `smtplib.SMTP_SSL`
  login and send — never `pgrep -f sink.py`**, which matches its own command line and always
  reports success. Without it, `basic`'s five api-key tests fail with `mail_error`.
- **Chromium**: this box has revision 1194, Playwright 1.62 wants 1234. Needs a temporary
  `launchOptions.executablePath` in `tests/playwright.config.base.ts`. **Never commit it.**

Two smaller ones, each of which has eaten time:

- Kill the dev server in a Bash call of its own — `fuser -k 5173/tcp` combined with later commands
  takes the tool's own shell down with it.
- `rime:use` runs `clear --force` then `init`. Interrupting it between the two leaves the repo
  without `src/hooks.server.ts` and vite refuses to boot; re-running `rime:use` repairs it. Also:
  do not delete `+rime.generated/schema.server.ts` to force regeneration — vite requires the file
  to exist at boot. Let codegen overwrite it in place.
