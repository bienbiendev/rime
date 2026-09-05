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
  call sites). `Adapter` is a **declared interface** in `core/adapter/types.ts`, not
  `ReturnType<typeof …>`, so a second adapter has something to conform to. Its two prototype
  facades collapsed into one `prototype.server.ts`; `generate-schema` went 261 → 150 lines and one
  loop.
- **Prototypes** own their local API, operations, REST, config factory and hooks. `core/rest/` is
  deleted. A definition declares `name`, `configKey`, `titleFallback`, `singleton`, `features`,
  `augments`, `hooks` and its own whole-config `configure` — and `definePrototype` composes
  `create` from them, so `prototype/*/config/` is gone and there is one config factory rather than
  four.
- **Features** are a contract with `augment` (per prototype config), `configure` (whole config),
  `shadow`, `handler`, `boot` and `hooks`. Ten of them: `auth`, `panel`, `upload`, `nested`,
  `url`, `versions`, `cors`, `metas`, `thumbnail`, `title`.
- **The config chain names nothing.** Four lines — prototypes, features, pipelines, plugins — and
  no file in `core/config/` mentions a feature. Both layers refine the config's _type_ through
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
  `versionOperation` (stage 1), and the shadow table is now **declared by the feature that owns
  it** rather than inferred from `config.versions` (stage 2, schema half). `generate-schema` no
  longer imports the versions feature at all.

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
concentrate in four files — `config/context.server.ts` 6, `build.server.ts` 4, `validate.server.ts`
3, `types.ts` 3 — which is items 4 and 5 below. Two of core's are a prototype naming its own
`configKey`, which is the whole point of `configKey` and not a hit to remove.

Gates, on the `versions` fixture: `check` **0**, `eslint src/lib` **21**, `check:circular-deps`
**3**, `vitest` **124**. On `basic`, `check` is **13**; on `versions-multilang`, **6**. All three
verified pre-existing. See `probing.md` §1.

---

## 4. What is left, in order

Cheapest first. Each is independently useful and each has a document behind it.

1. **`augment-panel.ts` stops reading `config.upload`** — a panel default keyed on a feature.
   Upload can offer a dashboard layout the way it offers `_titleFallback`. No contract change; the
   one true one-sitting fix. (`coupling-audit.md` §2)
2. **`FeatureDefinition.validate`** — moves the auth-collection rules out of
   `config/validate.server.ts`. A contract member with one caller.
3. **Features contribute to `createBlankDocument`** — moves upload's `sizes` out of
   `prototype/doc.ts`. Same shape as 2; `prototype/api.server.ts` already notes the gap.
4. **`validate.server.ts` (18 mentions of `collections`/`areas`) and `context.server.ts` (16) fold
   the registry** instead of listing the two by hand. `prototypeConfigs()` and `prototypeEntries()` exist;
   the schema generator is the worked example.
5. **`Config`'s authoring surface derives its prototype members from the registry** — the
   type-level half of 4, and what makes a third prototype cost only its own folder.
6. **versions stage 2, runtime half** — `registerPrototype` still resolves the shadow from slug
   suffixes. The declaration exists; boot order is why it is a separate step (codegen runs at step
   4, registration at step 6). Then stages 3–5: the read selector, the write plan, the remainder.
   (`decoupling-versions.md`)
7. **`_generateSchema: false` becomes the capability declaration it stands in for** — the last of
   `structure-audit.md` §19.4's four steps; the other three are done.
8. **Auth's boot goes through `bootFeatures`** — needs `boot` to take the adapter and context and
   to contribute a member back. A contract change, not a relocation. Bigger than it looks.
9. **A hook timing meaning "always"**, which lets versions carry its own `beforeUpdate` hooks and
   removes the last place a prototype names a feature.
10. **The panel.** Largest and last. Read `coupling-audit.md` §5 first: the work is _core letting
    go of `src/lib/panel/`_ (19 import lines, 13 of them in `handlers/routes.server.ts`), not the
    panel letting go of core — and the end state still has a collection screen and an area screen.

Also open, not on the ladder:

- **`bun run test` (375 e2e) has never run in this container.** No SMTP sink; Chromium 1194 vs
  Playwright's 1234. `probing.md` is the substitute and says what it does not cover — though §7
  now drives Chromium 1194 through `playwright-core` directly, which is enough to load the panel
  and read its console, just not to run the suite.
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
