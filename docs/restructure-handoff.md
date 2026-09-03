# Restructure handoff

Working notes for whoever picks this up next — most likely me, with none of the context. The
north star is `docs/architecture-target.md`; this file records where the work has actually got to,
what is left, and the handful of rules that were expensive to learn and are easy to break again.

Branch: `claude/repo-structure-audit-89hs4d`.

---

## The idea, in three lines

| layer | verb | scale |
| --- | --- | --- |
| **prototype** | *defines* | the base thing itself |
| **feature** | *augments and extends* | large — across prototypes, adds shadows and children |
| **plugin** | *augments* | small |

`collection` and `area` are two definitions built to the same pattern, not one implementation with
a `singleton` discriminator. Each brings its own surface: local API, operations, REST, config
factory, hooks. The adapter knows `base / shadow / child / branch` and nothing about kinds.

**The whole point, stated the way it kept having to be restated: each part of the system is
responsible for itself. A prototype does not know what a feature is.** If a prototype file ever
names `upload` again, something has gone backwards.

---

## Done

| # | commit | what |
| --- | --- | --- |
| 1 | `9ed1e9d` | adapter speaks base/shadow/child/branch; `adapter.{collection,area}` deleted |
| 2 | `675fc77` | definitions own their local API and operations |
| 3 | `2a8c015` | definitions own their REST; codegen reads the registry; `core/rest/` deleted |
| 4 | `f7c49f4` | the feature contract, with `url` as its first inhabitant |
| 5 | `1f8e759` | `upload`, `nested`, `versions`' augment become features |
| 6 | `0fa7f49` | `$rime/modules` resolves per name instead of through a whole-package barrel |
| 7 | `e3ea8f8` | definitions own their config factory and their pipeline |
| 8 | `fd621f2` | hooks declare `requires`/`provides`; the order is **resolved**, not written |
| 8h | `f21fc07` | `hooks.generated.md` renders as a tree, tagged by contributing feature |
| 9b/9c | `ceefc6e` | `factory/shared` becomes features; the registry stops naming features in its types |
| 9-pre/9a | `28143da` | `Rime` is declared, not inferred; the prototype declares `features` and `hooks`; **both `pipeline.server.ts` files deleted** |

Structural greps (`docs/architecture-target.md`'s own test):

```
adapter.collection. / adapter.area.   13 -> 0   ✓
isArea|isCollection|type === '...'    65 -> 59  (the rest are panel and config-factory)
```

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
> `RimeAuth<C>`), never from `createRime` or `bootRime`. A phantom is declared *about* a config,
> so naming it costs nothing. Naming a function that imports the prototype registry puts every
> hook back in the loop.

Four places currently hold that line — if a self-reference cascade returns, check these first:

- `core/rime.server.ts` — `Rime` / `RimeContext` declared.
- `core/prototype/registry.ts` — `prototypes: RegisteredPrototype[]` **annotated**. Inferring it
  makes `BuildConfig` depend on every feature's hooks.
- `core/prototype/accessors.server.ts` — accessors read from `api.server.ts`, which imports no
  hooks, rather than off each definition's `$InferAccessor`.
- `core/features/auth/better-auth/instance.server.ts` — `RimeAuth` lives here so its *type* can be
  named without naming `bootRime`.

The cost is real and one-directional: `Rime` is hand-maintained, and a member added to
`createRime` without adding it to the interface is invisible to consumers. `satisfies` catches
only the opposite mistake.

### 2. Field order is column order

The config factories fix the order in which augments append fields, and that is the order of the
columns in the generated schema. **Never reorder an augment chain or a `features` list casually.**
The gate is the golden schema diff (below), and it is the only thing that catches it.

### 3. A feature must not import a prototype's *server* definition

`collection/definition.ts` imports every feature (it lists them), so a feature importing the
definition back closes a module cycle. That is survivable when the back-edge is read inside a
function — but `definition.server.ts` spreads `{ ...base }` **at module scope**, so if
`definition.ts` is entered first the spread sees an uninitialized binding and the definition
silently loses `features`/`hooks`.

This is why `core/prototype/collection/hooks.server.ts` exists as its own file: a list of hooks
depends on nothing, so a feature deriving a collection (`upload/directories`, `versions/derive`)
can import it from anywhere. Both call
`augmentHooks({ features: collectionPrototype.features, hooks: collectionHooks }, cfg)`.

### 4. A mark nothing active provides is satisfied (the vacuous rule)

`requires: ['x']` means *after **every** active provider of `x`* — and if nothing active provides
it, the requirement is met. That is what lets one declaration be correct in both `beforeCreate`
and `beforeUpdate`, and what keeps a feature's mark from breaking configs without that feature.

Consequences worth remembering:

- `HookMark` is a **closed union** (`core/operations/types.ts`) extended by features through
  declaration merging. It must stay closed: a typo'd mark is *vacuously satisfied* and reorders
  the pipeline silently — the one failure mode of this design that raises no error at all.
- Marks that both require and provide `document` cannot require `document` of each other without
  closing a cycle. When a real ordering is needed between two such hooks, name the specific thing
  (`populateURL` requires `title`), not the generic one.
- `data-inspected` is the write-side twin of `sanitized`: the auth `beforeUpdate` guards provide
  it and `buildDataConfigMap` requires it. It exists because `preventUserMutations` rejects on
  `'name' in args.data` — run it after `setDefaultValues` and a filled default 401s every user
  update.

### 5. Re-measure baselines on the *same fixture*

`rime:use <fixture>` swaps the active fixture and it changes the `bun run check` count. A
post-change measurement compared against a baseline taken on a different fixture reads as a
regression that is not there. This has happened; it cost a round.

---

## Gates, and what they are for

Run against the base commit's **own** numbers, re-measured, not trusted from any doc.

| gate | command | note |
| --- | --- | --- |
| types | `bun run check` | 6 pre-existing errors on both `basic` and `versions-multilang` (`collection/operations/create.ts` ×4, `duplicate.ts`, `set-document-thumbnail.server.ts`) — all `DeepPartial` / union-narrowing in generated-type land |
| lint | `bunx eslint src/lib` | 21; the rest are pre-existing panel `goto()`/`href` and two unused `toKebabCase` |
| cycles | `bun run check:circular-deps` | 5, and the *list* matters more than the count |
| unit | `bunx vitest run` | 115 |
| schema | diff the generated `schema.server.ts` against a golden capture | **the gate for rule 2** |
| pipeline order | `core/operations/pipeline-order.spec.ts` | **the gate for rule 4** — a wrong mark is schema-identical and probe-identical |
| e2e | `bun run test` | expect 375 |

**Capture a golden schema before touching any augment chain.** Boot the dev server on a fixture,
copy `src/lib/+rime.generated/schema.server.ts` somewhere outside the repo, make the change, boot
again, diff. It is generated, gitignored, and cheap to lose.

### Live probes

Scratch scripts exercising both pipelines end to end: create a page and check `title` / `url` /
`_type` / `_thumbnail`; blocks + tree + locale writes; both junction shapes plus a real upload; the
versioned-area draft-only 404. They need a seeded admin —
`POST /api/init {email,name,password}` — because `rime:use` recreates the database.

The one probe that discriminates hardest, and the reason it exists: a **base64**
`POST /api/medias` must return `filename`, `mimeType`, `filesize`, all five sizes, `_path` and
`_thumbnail`. A multipart upload does not go through `castBase64ToFile`, so it legitimately leaves
`mimeType` null — don't read that as a regression.

### Booting is a gate of its own

Three of the six bugs in `28143da` were invisible to every static check and only appeared on
`bun run dev`: duplicate fields rejected at validation, areas 404ing because boot iterated the
wrong registry, and a definition that had silently lost its hooks. **Boot the server and hit an
area and a collection before believing a green check.**

---

## What is left

### Commit 9 remainder — `augment` moves onto `definePrototype`

The definition declares its augment chain and `definePrototype` returns the composed `create`, so
`prototype/*/config/` stops being a folder and becomes a prop. Two things already settled and
worth not relitigating:

- `create` stays public authoring API (`Collection.create('pages', {…})`, re-exported as
  `* as Collection`). Nothing loops it, so there is no dispatch to generalise.
- `config/{index,index.server}.ts` is deliberately **not** a `$rime/modules` pair — the two-sided
  barrel picks the side by which file imports it, which is the older and simpler mechanism.

Note the client and server factories currently import `collectionFeatures` from `definition.ts`
*and* the definition from `definition.server.ts`. The runtime list is the same array; the separate
import survives because `applyAugments` needs the `as const` tuple for the type fold, which
`PrototypeDefinition.features: FeatureDefinition[]` has widened away.

### Commit 10 — the two directories go

`factory/` is down to `config/` and `hooks.ts` (`factory/shared/` is gone). `operations/` holds
`run.server.ts`, `steps/`, `persist/`, `config-map/`, `query.ts`, `extract-data.server.ts`,
`types.ts`, and the two pipeline files — shared document-pipeline machinery every prototype calls.
None of it is prototype-specific, so this is a rename that says what it is — `core/config/` and
`core/pipeline/` — plus deciding where `factory/hooks.ts` belongs.

But four things in those two directories are **misfiled, not just misnamed**, and a rename that
carries them along preserves the mistake. Each is small. Roughly cheapest first:

#### a. `config/augment-prototypes.ts` belongs to the prototype

Thirteen lines that default `collections` and `areas` to `[]` — the config factory naming the two
kinds by hand, which is the coupling commit 1 spent its round removing everywhere else. It should
come from the prototype: an augment declared on `definePrototype` (the commit 9 remainder above
opens that slot) or a prototype-specific feature, so that adding a third prototype is not an edit
inside `core/config/`. Server-only today — `build.ts` never calls it, which is itself a smell.

#### b. The hook machinery is split across both directories

`operations/build-pipeline.server.ts`, `operations/resolve-pipeline.server.ts`, their two specs
(`pipeline-order.spec.ts`, `resolve-pipeline.spec.ts`), `operations/steps/`, and
`factory/hooks.ts` are one subject — how a hook declares itself, how the order is resolved, what
actually runs — split across two folders by where files happened to land. They colocate, under
whatever `core/pipeline/` becomes. `factory/hooks.ts` is the `Hooks.*` authoring helper (~20
feature and prototype files import it); it is the consumer-facing half of the same subject and
moves with it.

The other half of the question is whether some of `steps/` should be steps at all. A step that
only ever runs for one prototype or one feature is a hook that was never declared as one, and the
`requires`/`provides` resolver (rule 4) is what makes converting it safe. Judge it per step —
**a feature whose only content is one hook is ceremony**; prefer hanging the hook off the
prototype's own `hooks.server.ts`, or off a feature that already exists, over minting a new
feature for it.

#### c. `augment-plugins.ts` and `augment-plugins.server.ts` merge

Both build a plugin list, run each plugin's `configure`, and return `{ ...config, plugins }`. The
server one additionally seeds `sse` / `cache` / `apiInit` (dev) / `mailer`, and folds
`plugin.routes` into `$routes`. Now that plugins are declared isomorphic that is one function with
a server branch, not two files. **`build.server.ts` currently calls both** —
`augmentPluginsServer` and then `augmentPlugins` — so the merge has to not prepend `cache()` twice
and not re-run every `configure` a second time (which today it does).

#### d. The three panel augments want to be a `panel` feature

`augment-icons.ts`, `augment-panel.ts`, `augment-panel-access.server.ts` — about 60 lines that
build the slug→icon map, default the navigation groups / language / components, and default
`panel.$access` to `isAdmin`. All three are panel concerns living in the config factory. The panel
itself was never part of this restructure, so this is not a promise to restructure it; a `panel`
feature is simply where these belong and a start on the rest.

Do (a) first: `augment-icons` reads `collections` and `areas` off the config, so a panel feature
built before the prototypes stop being named in `core/config/` just moves that coupling one level
down.

#### The gate for all four

They are all augment-chain edits, so **rule 2 applies**. None of the four appends fields, so the
generated column order should not move — "should not" being exactly what the golden schema diff is
for. Capture one before starting. The chains as they stand:

```
build.server.ts  staff → prototypes → icons → panel → panelAccess → cors → pluginsServer → features → plugins
build.ts         staff → icons → panel → features → plugins
```

`configureWithFeatures` (the `features` step) *does* append fields, so moving any of these across
it is the move that would show up in the diff.

### Known loose ends

- **`hooks.generated.md` is not regenerated on a normal boot.** It needs
  `RIME_GENERATE_HOOKS_CHART=true`, it writes to the repo root, and `rime:use` deletes it. It is
  committed from the **`basic`** fixture — regenerate it there, or its diff becomes a fixture swap
  instead of a real order diff. Codegen also memoises: `rm node_modules/.rime/config.txt` to force
  a run.
- `$rime/modules` warns on boot that `core/plugins/cache` exports `toHash` from its server half
  only. Legal and intentional; the warning exists so an asymmetry that *does* break shows up.

---

## Environment

Both must be redone after any container restart.

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
