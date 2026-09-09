# Contributing

You can contribute to this project in many ways :

- adding tests
- improving [documentation](https://github.com/bienbiendev/rime-doc/tree/master/docs)
- adding features
- adding translation for the panel in your language
- make it work for .js only
- try other Sveltekit adapters and adjust the build command to handle these.

## Codebase structure

- [Architecture target](./docs/architecture-target.md) — the three layers (prototype, feature, plugin), the three phases, and where each layer is injected.
- [Decoupling rime](./docs/decoupling.md) — where the layering actually stands, the audit behind it, and the staged plan to finish it.
- [Working on this codebase](#working-on-this-codebase) — below: the rules, the gates, and every trap that has cost a round.

## Clone the repo

```bash
git clone https://github.com/bienbiendev/rime.git
```

## Install deps

```bash
cd rime
bun install
```

> Note : I am using `bun` because pnpm's dependency hoisting breaks type declaration generation at build time (nested transitive types, like `zod`'s, become impossible for TypeScript to name portably), and because it lets CLI commands run straight from their `.ts` files, with no separate compile step.

## Add your .env file

```bash
# Must be at least 32 characters, or better-auth warns on every boot
BETTER_AUTH_SECRET=supersecret

PUBLIC_RIME_URL=http://localhost:5173

# Where your config lives. Required in this repo: `rime:use` copies each test
# config to src/lib/+rime, while RIME_CONFIG_DIR defaults to src/+rime.
RIME_CONFIG_DIR=src/lib/+rime
RIME_CACHE_ENABLED=false
RIME_LOG_LEVEL=TRACE
RIME_LOG_TO_FILE=true
RIME_LOG_TO_FILE_MAX_DAYS=1

# RIME_SMTP_USER=
# RIME_SMTP_PASSWORD=
# RIME_SMTP_HOST=
# RIME_SMTP_PORT=
```

## Init & run

```bash
bunx svelte-kit sync
bun ./src/lib/core/dev/cli/index.ts init
bun run dev
```

## Configuration

[Configuration Overview](https://github.com/bienbiendev/rime-doc/blob/master/docs/03-configuration/00-overview.md)

## Use a predifined config as a starting point

```bash
bun run rime:use basic
```

Available names are `empty`, `basic`, `multilang`, `versions`, `versions-multilang`, respective config live inside the /tests directory.

## CLI commands

Sanitize config, and generates schema, types, routes

```bash
bun ./src/lib/core/dev/cli/index.ts generate
bun ./src/lib/core/dev/cli/index.ts generate --force
```

Clear all rime related files

```bash
bun ./src/lib/core/dev/cli/index.ts clear
bun ./src/lib/core/dev/cli/index.ts clear --force
```

Build the project with adapter-node

```bash
bun ./src/lib/core/dev/cli/build.ts build
# Also copy database to the app folder
bun ./src/lib/core/dev/cli/build.ts build -d
# Also add a .env file to the app folder
bun ./src/lib/core/dev/cli/build.ts build -e
```

---

# Working on this codebase

Everything below was paid for in rounds. It is not style advice — each rule has a failure behind
it, and most of those failures were **green on every static check**.

## The shape, in three lines

```
prototype  definePrototype  — collection / area. What every document of a kind has.
feature    defineFeature    — versions, upload, auth, url, nested, title, panel, …
plugin     definePlugin     — user land.
```

A feature does its work through the seams on `FeatureDefinition` — `augment`, `configure`,
`validate`, `blank`, `seed`, `shadow`, `writePlan`, `readQuery`, `hooks`, `handler` — and through
nothing else. If a feature's name appears in `core/` or in `adapter-sqlite/`, a seam is missing.
See `docs/decoupling.md`.

## The rules

### 1. Anything reachable from `Rime`'s type graph must **declare** its type, never infer it

`Rime` was `Awaited<ReturnType<typeof createRime>>`. Every hook is typed through
`HookContext → event → App.Locals → rime`, so the moment a definition in `createRime`'s value graph
carried hooks, each hook referenced itself and TypeScript answered `any`. One inferred alias, three
symptoms: inline `$hooks` broke, accessors resolved to `never`, a prototype could not carry its own
hooks (100 errors).

> Take types from **declared config phantoms** (`BuildConfig<C>['$InferPluginsServer']`,
> `RimeAuth<C>`), never from `createRime` or `bootRime`.

Four places hold that line — check them first if a self-reference cascade returns:

- `core/rime.server.ts` — `Rime` / `RimeContext` declared.
- `core/prototype/registry.ts` — `prototypes: RegisteredPrototype[]` **annotated**.
- `core/prototype/accessors.server.ts` — reads from `api.server.ts`, which imports no hooks.
- `core/features/auth/better-auth/instance.server.ts` — `RimeAuth` lives here so its _type_ can be
  named without naming `bootRime`.

The cost is one-directional: `Rime` is hand-maintained, and a member added to `createRime` without
adding it to the interface is invisible to consumers. `satisfies` catches only the opposite mistake.

### 2. Field order is column order

The config factories fix the order in which augments append fields, and that is the order of the
columns in the generated schema. **Never reorder an augment chain or a `features` list casually.**
The golden schema diff is the only gate that catches it.

### 3. A feature must not import a prototype's _server_ definition

`collection/definition.ts` imports every feature, so a feature importing the definition back closes
a cycle. Survivable when the back-edge is read inside a function — but `definition.server.ts`
spreads `{ ...base }` **at module scope**, so if `definition.ts` is entered first the spread sees an
uninitialized binding and the definition silently loses `features`/`hooks`.

That is why `collection/hooks.server.ts` is its own file: a list of hooks depends on nothing.

**The features list cannot be filed the same way** — it contains the features themselves, so any
file reaching it from inside a feature can be entered while that feature is still evaluating, and
the array literal captures `undefined`. `versions/derive.server.ts` did this for years without
incident because only `build.server.ts` reached it; the moment that call became the feature's own
`configure`, the path became `area/definition.ts → versions/index.ts → derive.server.ts →
collection/definition.ts` and `collectionFeatures` came out
`[auth, panel, upload, nested, UNDEFINED, url, …]`.

> **`FeatureDefinition.configure` takes the prototypes as an argument.** A feature that needs a
> prototype's `features` or `hooks` gets them from the registry the caller hands over.

The same edge from the other side is worse. Both config factories used to read the prototype off
`definition.server.ts` just to hand `{ features, hooks }` to `augmentHooks`; adding one feature to a
list reordered the graph, the spread ran early, the definition came out **without `features`**, and
every feature hook stopped running while the prototype's own kept going. Documents came back with no
`title` and no `url` — and `check`, `eslint`, `madge`, the unit suite, the generated schema **and
the generated hooks chart** were byte-identical to baseline. The chart is built from the config, not
from what boots. Only a live read caught it. `prototype/collection/pipeline.spec.ts` now asserts
both layers are in the pipeline.

### 4. The hook order is written down, and only enablement is computed

Each prototype's `hooks.server.ts` places every hook it can run, in the order it runs them.
`buildPipeline` decides only _which_ of them this config runs — `feature.enabled(config)` — and
appends the consumer's after, then `sortDocumentProps` after that.

It used to be derived: hooks declared `requires`/`provides` and a resolver sorted them. That bought
a generality nothing used — thirteen marks encoding four real dependencies — and paid for it in a
failure mode with no symptom. A mark nothing active provides was satisfied _vacuously_, so a
misspelling did not disable a hook, it **hoisted it to the front of the timing**. In `beforeUpdate`
that is a security question: `preventUserMutations` rejects on `'name' in args.data`, so a default
filled in before it turns an ordinary update into a 401.

Two things a written order needs, and both are in `buildPipeline`:

- **It refuses to boot** if a feature contributes a hook no prototype places. That hook would
  simply never run and nothing else would say so — the one failure this trades for the resolver's.
- **`sortDocumentProps` is in neither list.** Nothing may precede it and nothing may follow, so it
  is appended rather than placed; a list is for things whose position is a choice.

The cost, stated once: **a consumer's hooks are appended, not interleaved.** They cannot land
between two of the prototype's — though they still run before the finaliser, so a property they add
comes back sorted.

### 5. Re-measure baselines on the _same fixture_

`rime:use <fixture>` swaps the active fixture and changes the `bun run check` count. A measurement
compared against a baseline taken on a different fixture reads as a regression that is not there.

### 6. Whole-config steps belong to whoever owns them

| layer     | declares in                                       | folded by                 |
| --------- | ------------------------------------------------- | ------------------------- |
| prototype | `prototype/register.ts` — `PrototypeConfigure<T>` | `configureWithPrototypes` |
| feature   | `features/register.ts` — `FeatureConfigure<T>`    | `configureWithFeatures`   |

The server chain is three lines — prototypes, features, plugins — and **nothing in `core/config/`
names a feature**. Three consequences:

1. **The type-level fold is a hand-written list** (`ConfigureTransforms`) — of _names_, not of an
   order. Every `FeatureConfigure` declaration is additive (`T & {…}`), so composition order does
   not matter; the list exists because an intersection built from a key union stays deferred for a
   **generic** `T`, and `bootRime<C>` reads `config.panel.language` while `C` is a type parameter.
   `features/registry.spec.ts` asserts both invariants at compile time.
2. **A `configure` is handed the prototypes; it must never import one.** See rule 3.
3. **A default with exactly one reader does not need a config step at all.** `grep` the member
   first — one consumer means `??` at that line.

`config/inference.spec.ts` guards the chain staying a literal sequence: a reduce over an array of
augments widens every slug literal to `string`.

### 7. A feature's `index.ts` must not import its own `.server.ts` hooks

Rule 3's other half, and it cost the whole panel. A prototype's `features` list is reachable from a
**client** build, so every feature `index.ts` is isomorphic and a hook it imports by path travels
into the browser graph. Every module request 500'd with:

```
Error: An impossible situation occurred    (@sveltejs/kit/src/exports/vite/index.js:798)
```

which is SvelteKit's server-only guard **firing correctly** and then failing to explain itself: it
walks the importer chain to print a "Cannot import X into code that runs in the browser" pyramid,
follows `candidates[0]` — one arbitrary branch — and throws that fallback when the branch dead-ends
before a route entrypoint. The message names nothing. **The 500'd request URLs name everything**;
see `docs/probing.md` §7.

The fix is the convention that already exists: a `hooks/module.server.ts` with **no `module.ts`
beside it**, imported as a name from `$rime/modules`.

**And never move a constant to make an isomorphic file reach it.** `.server` is what stops a browser
bundle ever carrying `PRIVATE_FIELDS`. What crosses `$rime/modules` is the **function**, which is
`undefined` on a client build and never called there. Only a module with no client half gets its
names stubbed to `undefined`; a pair with both halves exports the client half's names and a
server-only name is simply _missing_ (`docs/rime-modules-resolution.md`, cases B and C).

Nothing static sees this. **Load the panel in a browser** before believing a green run that touched
a feature's imports.

### 8. A prototype listing a feature's hook means **core is missing a default**

Both prototypes' `beforeUpdate` named `defineVersionOperation` and `handleNewVersion` by import, and
the comment said they "run for every config, versioned or not, so `enabled` cannot gate them". True,
and not the reason. Each was answering a question **core has for every prototype**, and core had no
answer of its own:

| the question                               | who answered                            | what a prototype with no shadow answers |
| ------------------------------------------ | --------------------------------------- | --------------------------------------- |
| where does this document's content live?   | `handleNewVersion`'s `default:` branch  | its own row                             |
| which revision does an update branch from? | `shouldRetrieveDraft(versionOperation)` | the only one                            |

> The fix is never "find a timing that means always". It is: **core states the default, the feature
> overrides it.**

`resolveContentOwner` provides `content-owner`; `handleNewVersion` requires it and answers again.
Then `enabled` is the right gate and the feature carries its own hooks.

Two things this surfaced:

- **Marks that were being met by the hand-written position.** `handleNewVersion` read
  `originalConfigMap` without requiring `original-config-map`, and had to run before
  `setDefaultValues` without providing `data-inspected`. A hook only survives becoming a feature's
  if **every** edge it depends on is declared — and the second is not cosmetic: run it after the
  defaults and editing one field resets every unsent field to its default.
- **What this rule is actually about is conditionality, not listing.** A prototype _does_ list
  every hook it can run — `prototype/collection/hooks.server.ts` — because the order is written
  down rather than computed. What went wrong with those two hooks was that they ran for configs
  with no versions at all. `buildPipeline` filters the list by `feature.enabled(config)`, and
  refuses to boot if a feature contributes a hook no prototype places, so a listed hook cannot
  fire where its feature is off and an unlisted one cannot vanish silently.

## Gates

Run against the base commit's **own** numbers, re-measured, never trusted from a doc.

| gate            | command                                   | note                                                                                     |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| types           | `bun run check`                           | fixture-dependent — **0 on `versions`**. Count what the run prints                       |
| lint            | `bunx eslint src/lib`                     | ~20; the rest are pre-existing panel `goto()`/`href`                                     |
| cycles          | `bun run check:circular-deps`             | 3 — and the _list_ matters more than the count                                           |
| unit            | `bunx vitest run`                         | 165                                                                                      |
| format          | `bunx prettier --check .`                 | run it before committing, not after                                                      |
| pipeline layers | `prototype/collection/pipeline.spec.ts`   | **the gate for rule 3** — a definition that lost its `features` is green everywhere else |
| schema          | golden diff + `bunx drizzle-kit generate` | **the gate for rule 2** — see below; the byte diff alone is not it                       |
| pipeline order  | `core/pipeline/pipeline-order.spec.ts`    | pins the order each prototype's `hooks.server.ts` writes down, per config shape          |
| hooks chart     | `hooks.generated.md`                      | which of those hooks _this_ config runs, after `enabled` filtering                       |
| e2e             | `bun run test:<fixture>`                  | per-fixture baselines below                                                              |
| browser         | `docs/probing.md` §7                      | **the gate for rule 7** — nothing static sees it                                         |

**Capture a golden schema before touching any augment chain** — or anything that emits a column.
Codegen runs headless, so this needs no dev server:

```bash
rm node_modules/.rime/config.txt          # codegen memoises; this forces a run
bun ./src/lib/core/dev/cli/index.ts generate --force
cp src/lib/+rime.generated/schema.server.ts /tmp/schema-before.ts
# … make the change, regenerate, diff …
bunx drizzle-kit generate                 # must print "No schema changes, nothing to migrate"
```

`schema.server.ts` is generated, gitignored, and cheap to lose.

**Read the diff for column order; let drizzle-kit answer whether the schema changed.** A generator
does not reproduce hand-written whitespace, quote style or chain order, so a byte diff is never
empty after a template change and says nothing on its own. `drizzle-kit generate` reads the _built_
schema rather than the source, so "No schema changes" means the tables are identical however they
are spelled. Both matter: column order is a migration (rule 2), and drizzle-kit is what proves
nothing else moved.

### e2e baselines

Per fixture, and re-measure them in your own container before comparing:

| fixture              | expected                                                            |
| -------------------- | ------------------------------------------------------------------- |
| `versions`           | 54 / 54                                                             |
| `versions-multilang` | 57 / 57                                                             |
| `multilang`          | 74 / 74                                                             |
| `basic`              | 85 pass, 12 fail on a box with no working Chromium and no SMTP sink |
| `fields`             | 72 pass                                                             |

A failure count is only a signal against a baseline **from the same box**. `basic`'s 12 split into
8 Chromium-launch errors and 4 api-key/SMTP.

## The loop that actually works

1. Take the baseline first, on the fixture you will re-measure on.
2. Make the change.
3. **Prove the guard by breaking it.** Delete the hook you just added and count the failures. If
   the number does not move, the guard is not doing what you think — this caught two changes that
   were passing for the wrong reason (a `url` computed on read, so every stored-`url` assertion was
   vacuous; `_children` with no assertion at all).
4. Re-run the gates on the same fixture.
5. Boot and probe. `docs/probing.md` has the request shapes.

## Traps

Each of these has eaten at least a round.

- **`git checkout <file>` after a probe reverts your work.** Probing often leaves generated files
  dirty and the reflex is to check them out. Stash instead.
- **Running `bun run check` while a background e2e run switches fixtures** gives spurious counts —
  seen at 215, 263, and other numbers that look like catastrophe. Never overlap them.
- **`pgrep -f sink.py` always succeeds** because it matches its own command line. Verify the SMTP
  sink with a real `smtplib.SMTP_SSL` login and send.
- **Kill the dev server in a Bash call of its own.** `fuser -k 5173/tcp` combined with later
  commands takes the shell down with it.
- **`rime:use` runs `clear --force` then `init`.** Interrupting between the two leaves the repo
  without `src/hooks.server.ts` and vite refuses to boot; re-run `rime:use` to repair.
- **Do not delete `+rime.generated/schema.server.ts` to force regeneration** — vite requires the
  file to exist at boot. Let codegen overwrite it in place. Codegen also memoises:
  `rm node_modules/.rime/config.txt` forces a run.
- **`hooks.generated.md` is not regenerated on a normal boot.** It needs
  `RIME_GENERATE_HOOKS_CHART=true`, writes to the repo root, and `rime:use` deletes it. It is
  committed from the **`basic`** fixture — regenerate it there or its diff is a fixture swap.
- **`curl` needs `-g`** for any `where[...]` filter, a list endpoint hides drafts, and a `PATCH`
  with no `versionId` targets the published version.
- **vite dev-server startup can time out at 180s** under load. That is the environment, not a test
  failure; re-run before believing it.
- **Grep for feature names case-insensitively, as identifiers and in comments — not for imports.**
  An adapter with zero `features/versions` imports still had `versionsTable`, `versionsLocalesTable`
  and a `hasVersions` branch. Imports are the easy half.
- **A green `bun run check` after moving a hook proves nothing about the pipeline.** Regenerate
  `hooks.generated.md` (`RIME_GENERATE_HOOKS_CHART=true`) and read the diff.

## Environment

A fresh container has no `node_modules/`, no `.env` and no active fixture — all gitignored. Before
they are back, `bun run check` reports ~200 errors. That is the fixture missing, not a regression.

```bash
bun install
# Write .env by hand (above) BEFORE `init`: `rime init` defaults RIME_CONFIG_DIR to src/+rime,
# this repo's fixtures land in src/lib/+rime, so init generates a starter config that imports
# 'rimecms/adapter-sqlite' and dies.
bun run rime:use basic
```

Two things must be redone after any container restart:

- **SMTP sink** on `127.0.0.1:1025`, implicit TLS. Without it, `basic`'s api-key tests fail with
  `mail_error`.
- **Chromium**: if the box's revision and Playwright's disagree, a temporary
  `launchOptions.executablePath` in `tests/playwright.config.base.ts` bridges it. **Never commit
  it.**
