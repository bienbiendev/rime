# Cold start

For whoever picks this up with none of the context — most likely me. Read this first; it is the
map. Everything else is a specialist document and this file says which one and when.

**Branch:** `claude/cold-start-commit-9-b0f03u`, cut from
`claude/restructure-handoff-docs-vnq2pq` · **no PR opened**. `develop` has moved a long way since
the fork, so measure rather than quote:

```bash
git rev-list --count origin/develop..HEAD          # 57
git diff --name-only origin/develop..HEAD | wc -l  # 465
```

---

## 1. What this branch is

A restructure of `src/lib` around three layers, replacing a codebase where `collection` and `area`
were two near-identical implementations and where the database layer knew what a collection was.

| layer         | verb                   | scale                                                | contract          |
| ------------- | ---------------------- | ---------------------------------------------------- | ----------------- |
| **prototype** | _defines_              | the base thing itself                                | `definePrototype` |
| **feature**   | _augments and extends_ | large — across prototypes, adds shadows and children | `defineFeature`   |
| **plugin**    | _augments_             | small                                                | `definePlugin`    |

`collection` and `area` are two definitions built to the same pattern, not one implementation with
a `singleton` discriminator. Each brings its own surface: local API, operations, REST, config
factory, hooks. The adapter speaks **base / shadow / child / branch** and knows nothing about
kinds.

> **The sentence that kept having to be restated: each part of the system is responsible for
> itself. A prototype does not know what a feature is.** If a prototype file ever names `upload`
> again, something has gone backwards.

The north star is `docs/architecture-target.md`.

---

## 2. Which document answers what

| you want                                                                       | read                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| the target design, stated                                                      | `architecture-target.md`                               |
| **how to verify anything without the e2e suite**                               | `probing.md`                                           |
| the rules that cost a round each, and the full Done table                      | `restructure-handoff.md`                               |
| every place core still names a feature or a kind, **measured**, with the greps | `coupling-audit.md`                                    |
| the deepest coupling, staged, with code beside each step                       | `decoupling-versions.md`                               |
| what the adapter's vocabulary is and why                                       | `decoupling-adapter.md`                                |
| bugs known and deliberately not fixed                                          | `known-defects.md`                                     |
| how the virtual barrel resolves, and the cycles it creates                     | `rime-modules-resolution.md`, `rime-modules-cycles.md` |
| the original audit, its design rounds, and §20's recomputation                 | `structure-audit.md`                                   |
| a piece of work not started                                                    | `decouple-field-type-from-parsing.md`                  |

---

## 3. Where it stands

### Done

Full table with commits in `restructure-handoff.md`. The shape of it:

- **The adapter** speaks base/shadow/child/branch; `adapter.{collection,area}` is gone (13 → 0
  call sites). `Adapter` is a **declared interface** in `core/adapter.ts`, not
  `ReturnType<typeof …>`, so a second adapter has something to conform to. Its two prototype
  facades collapsed into one `prototype.server.ts`; `generate-schema` went 261 → 150 lines and one
  loop.
- **A prototype names no feature in its own augments.** `augmentPanel` went with
  `augment-panel.ts`: `upload` states `_dashboardLayout: 'grid'` the way it states
  `_titleFallback`, and the dashboard — the only reader of `panel.dashboard` — keeps its own
  `'rows'` default instead of having one seeded for it twice. That also restored `panel: false`,
  which the augment had been spreading into an object.
- **Prototypes** own their local API, operations, REST, config factory and hooks. `core/rest/` is
  deleted. A definition declares `name`, `configKey`, `titleFallback`, `singleton`, `features`,
  `augments`, `hooks` and its own whole-config `configure` — and `definePrototype` composes
  `create` from them, so `prototype/*/config/` is gone and there is one config factory rather than
  four.
- **Features** are a contract with `augment` (per prototype config), `configure` (whole config),
  `shadow`, `handler`, `boot`, `validate`, `blank` and `hooks`. Ten of them: `auth`, `panel`, `upload`, `nested`,
  `url`, `versions`, `cors`, `metas`, `thumbnail`, `title`.
- **The config chain names nothing**, and neither does the config's _type_: `Config` extends
  `PrototypeMembers` and `BuiltConfig` takes `Required<PrototypeMembers>`, so `collections` and
  `areas` are declared beside the prototypes that own them. Four lines — prototypes, features,
  pipelines, plugins — and no file in `core/config/` mentions a feature. Both layers refine the config's _type_ through
  declaration merging (`PrototypeConfigure`, `FeatureConfigAugment`, `FeatureConfigure`).
- **Hooks declare `requires`/`provides`** and the order is resolved, not written. Both
  `pipeline.server.ts` files are deleted. Every pipeline is resolved **once**, at the end of the
  config build, from three lists: the prototype's, the enabled features', and the author's
  `$hooks`.
- **`$rime/modules`** resolves per name instead of through a whole-package barrel, and every
  feature reaches its server-only hooks through it. `auth`, `title` and `thumbnail` used to import
  theirs by path, which pulled `.server.ts` files into the browser graph — six 500s, and **the
  panel never loaded**. Each has a `hooks/module.server.ts` now. See rule 7.
- **The panel renders**, verified in a real browser — dashboard, a collection screen, an area
  document, no 500s and no console errors. It had not come up in this container before. The probe
  is `probing.md` §7 and it is the only gate that sees a server-only module reaching the client.
- **versions**, partway: the pipeline asks for `contentOwnerId` rather than carrying a
  `versionOperation` (stage 1), and the shadow table is **declared by the feature that owns it**
  rather than inferred from `config.versions` (stage 2, both halves) — the schema generator builds
  it from the declaration and boot hands the same declaration to `registerPrototype`, so neither
  `generate-schema` nor `adapter-sqlite/prototype.server.ts` imports the versions feature's naming
  any more. Stage 3 was built and **reverted** (`29192dae`): it put a `pick` selector — "the row
  whose column equals this value" — into the declaration, which is a query language inside the
  adapter contract. The tell is that it needed a per-request `latest` flag beside it to be usable;
  a declaration that needs a runtime flag is in the wrong place. Stages 3–5 are re-planned around
  adapter primitives instead: the operation resolves the content row and hands the adapter an id.
  `25a78cdc` is the part of stage 3 that survives — the adapter recognises a shadow by its table
  rather than by `config.versions`. **Stage 4's update half is done** (`1ec2dfca`, `5dac93c0`):
  `versionOperation` has left the adapter contract and the three branches of `updatePrototype`
  collapsed to one path, because the caller now hands down a _write plan_ — which rows this write
  touches, and with what — built by `runUpdate` after the data hooks and refined by
  `FeatureDefinition.writePlan`. The publish demotion is a versions hook over a new `updateWhere`
  primitive. **Stage 3 is done too** (`a89a72c9`): `draft` and `versionId` have left the contract
  and `config.versions` has left the read path — a read now carries a `content` filter the versions
  feature wrote (`FeatureDefinition.readQuery`), rather than three parameters the adapter decoded.
  Note the plan in `decoupling-versions.md` said to resolve an _id_ and pay a second query; that
  turned out to be wrong and the doc says why (a versioned list needs one content row per document,
  which no un-nested query expresses).
- **The versions feature carries its own hooks**, which it could not before (`9c66566a`,
  `76f308a2`, and the commit after). Both prototypes used to list `defineVersionOperation` and
  `handleNewVersion` by import, and `pipeline/` imported the feature's enum in three more places —
  so deleting `versions` would have broken core. The blocker was never the `enabled` gate: it was
  that core had **no default** for two things the feature was answering on everyone's behalf. Core
  states them now (`resolveContentOwner`, and `ReadIntent`) and the feature overrides. Rule 8 in
  `restructure-handoff.md`.
- **`bun run rime:pipeline`** renders every resolved pipeline — each hook with its `requires`,
  `provides`, and the feature that contributed it — into `docs/pipeline-map.md`, pinned by a spec
  so it cannot go stale. It is the readable view of a thing that exists nowhere in the source, and
  it makes "is this feature decoupled" a one-column question.

### Measured, right now

Re-run these; do not trust the numbers.

```bash
grep -rn "adapter\.collection\.\|adapter\.area\." src/lib                          # 0
grep -rEn "isArea|isCollection|=== 'collection'|=== 'area'|'collections'|'areas'" \
  src/lib --include=*.ts --include=*.svelte | wc -l                                # 72
grep -rn "from '\$lib/panel/" src/lib/core | wc -l                                 # 19
grep -rn "features/versions" src/lib/adapter-sqlite | wc -l                        # 7
```

Where the 72 kind-naming lines are: **32 in core**, **35 in the panel**, 4 in fields, and **1 in
the adapter** (`transform.server.ts:59`, `configCtx.isCollection(slug)` — the last one). Core's
concentrate in three files now — `config/context.server.ts` 6, `build.server.ts` 4,
`validate.server.ts` 3 — which is item 1 below. `config/types.ts` is down to 0: `Config` and
`BuiltConfig` take their prototype members from `PrototypeMembers`, which each prototype merges
beside its own definition. Two of core's are a prototype naming its own
`configKey`, which is the whole point of `configKey` and not a hit to remove.

Gates, on the `versions` fixture: `check` **0**, `eslint src/lib` **21**, `check:circular-deps`
**3**, `vitest` **124**. On `basic`, `check` is **13**; on `versions-multilang`, **6**. All three
verified pre-existing. See `probing.md` §1.

---

## 4. What is left, in order

Cheapest first. Each is independently useful and each has a document behind it.

1. **`validate.server.ts` (18 mentions of `collections`/`areas`) and `context.server.ts` (16) fold
   the registry** instead of listing the two by hand. `prototypeConfigs()` and `prototypeEntries()` exist;
   the schema generator is the worked example.
2. **The adapter is decoupled, and its surface is primitives.** `grep -rn "config\.versions\|features/versions" src/lib/adapter-sqlite`
   is empty, and `src/lib/adapter-sqlite` imports nothing from any individual feature — only
   `ShadowDeclaration` and `shadowOf`, which are the contract. What replaced the last of it:
   `ConfigContext.shadowSlugOf` (the transform and url writers), `contentId` on the url contract,
   `FeatureDefinition.seed` (a bootstrapped row's first version), and upload's `_path`
   normalisation moving into its own hook. (`decoupling-versions.md`)

   The `Adapter` interface is `registerPrototype`, `prototype` and five facades — nothing loose.
   Four members went in one pass: `childrenIds` (nested's question), `existingIds` (relation
   defaults'), `updateDocumentUrl` (url's, a four-way branch over locale × shadow), and the dead
   `updateRecord`, which named a _table_. What carries them is one pair of twins —
   `readWhere({ query, sort?, limit? })` and `updateWhere({ query, data, locale? })`, both flat
   over the prototype's own table — plus the fact that a shadow is a registered prototype, so
   writing to it is the same call to a different handle.

   Two feature-shaped things remain in the adapter, both their own piece of work:
   `generate-schema/templates.server.ts`'s `withDirectoriesSuffix` — the unbuilt `type: 'child'`
   declaration, which is item 3 below — and `auth.server.ts`'s whole facade.

   Also still open, outside the adapter: `features/upload/naming.ts` imports `withoutVersionsSuffix`
   from `features/versions`, a feature importing a feature (missed by earlier greps because it is a
   relative import).

3. **`_generateSchema: false` becomes the capability declaration it stands in for** — the last of
   `structure-audit.md` §19.4's four steps; the other three are done.
4. **Auth's boot goes through `bootFeatures`** — needs `boot` to take the adapter and context and
   to contribute a member back. A contract change, not a relocation. Bigger than it looks.
5. ~~**A hook timing meaning "always"**~~ — **dead**. It existed so `versions` could carry its own
   `beforeUpdate` hooks. Rule 8 in `restructure-handoff.md` replaced it: core states the default
   (`resolveContentOwner`, `ReadIntent`) and the feature overrides, so `enabled` became the right
   gate and no prototype names a feature any more.
6. **The panel.** Largest and last. Read `coupling-audit.md` §5 first: the work is _core letting
   go of `src/lib/panel/`_ (19 import lines, 13 of them in `handlers/routes.server.ts`), not the
   panel letting go of core — and the end state still has a collection screen and an area screen.

Also open, not on the ladder:

- **The e2e suite runs here, apart from the browser-driven tests.** Measured: `versions` 50/50,
  `versions-multilang` 57/57, `fields` 72 passed with 22 failing only on
  `Executable doesn't exist … chromium_headless_shell-1243` (this box has 1194), `basic` 85 passed
  with 8 the same and 5 the documented api-key tests wanting an SMTP sink. So an API-shaped change
  can be gated properly; a panel-shaped one still needs `probing.md` §7, which drives Chromium
  1194 through `playwright-core` directly.
- **No PR**, and `develop` has moved a long way ahead of the fork point (see §1). Whatever opens
  it will be a merge, not a fast-forward.

---

## 5. The seven rules, compressed

Each cost a round. `restructure-handoff.md` has the full statement and the symptom of breaking it.

1. **Anything reachable from `Rime`'s type graph must _declare_ its type, never infer it.** One
   inferred alias put every hook in a self-reference cascade and TypeScript answered `any`. Four
   files hold the line; they are listed there.
2. **Field order is column order.** Never reorder an augment chain or a `features` list casually.
   The golden schema diff is the only gate that catches it.
3. **A feature must not import a prototype's server definition.** `definition.server.ts` spreads
   `{ ...base }` at module scope; entered in the wrong order it silently loses `features`, and
   every static gate stays green. A `configure` is _handed_ the prototypes.
4. **A mark nothing active provides is vacuously satisfied.** So `HookMark` must stay a closed
   union — a typo'd mark reorders the pipeline with no error at all.
5. **Re-measure baselines on the same fixture.** `rime:use` changes the `check` count.

And the sixth, from commit 11: **a whole-config step belongs to whoever owns it.** Before writing
a `configure`, grep the member — if it has one reader, make it a `??` at that line and delete the
step.

And the seventh, which cost the whole panel: **a feature's `index.ts` must not import its own
`.server.ts` hooks.** A prototype's `features` list is reachable from a client build, so a hook
imported by path lands in the browser graph and SvelteKit refuses it with `An impossible situation
occurred` — its own guard firing and failing to name the file. Hooks go in a
`hooks/module.server.ts` with no `module.ts` beside it, reached through `$rime/modules`. No static
gate sees the difference; `probing.md` §7 is the one that does.

---

## 6. Starting from a cold container

`node_modules/`, `.env` and the active fixture are all gitignored, so a new container has none of
them and every gate reads as catastrophically broken until they are back.

```bash
bun install
bunx svelte-kit sync   # or the CLI cannot resolve $lib and `rime:use` dies on its own `clear` step
# .env is NOT in the repo. `rime init` writes one with the *consumer* default
# RIME_CONFIG_DIR=src/+rime — this repo's fixtures land in src/lib/+rime, so init then generates a
# starter config importing 'rimecms/adapter-sqlite' and dies. Write the file first (CONTRIBUTING.md
# has it in full), or fix the line and delete src/+rime{,.generated}.
bun run rime:use basic
```

Before that, `bun run check` reports ~200 errors. That is the fixture missing, not a regression.

**Adding a `module.server.ts` pair means regenerating the barrel's types**, or `check` reports
`Module '"$rime/modules"' has no exported member 'X'` for a name that plainly exists.
`src/rime.modules.generated.d.ts` is gitignored and written by `regenerateModulesDeclaration()`,
which runs when the dev server starts listening — or on demand, and codegen memoises, so:

```bash
rm node_modules/.rime/config.txt
bun ./src/lib/core/dev/cli/index.ts generate
```

Then read `probing.md` before touching anything.
