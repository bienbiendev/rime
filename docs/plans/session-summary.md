# Plugin unification + standalone config mode — what changed and why

Two related features landed together, plus fixes discovered by actually running them.

## 1. Plugin unification

**What**: `Plugin`/`PluginClient` merged into one type. `Config.$plugins`/`Config.plugins`
merged into one `plugins` key. `cache`, `sse`, `mailer`, `api-init` all restructured from a
single `index.server.ts` into `module.server.ts` (+ `module.ts` for `cache`, the only one
with real client behavior) + an isomorphic `index.ts`.

**Why**: A plugin needing both a client and server half (`cache`, registering a panel header
button _and_ server routes/actions) used to require two hand-written factories
(`cache()`/`cacheClient()`) and two config arrays (`$plugins`/`plugins`) to register them in.
The `$rime/<path>/module` mechanism (below) already exists for fields — applying the same
convention to plugins means one factory, one import, resolved differently per build target
automatically, instead of two of everything.

**Why it matters**: less to hand-maintain per plugin, and it's the same shape a consumer
would use for their own custom plugin — no special-casing built-ins vs custom ones.

**Files**: `core/plugins/index.ts`, `core/config/types.ts`, both `augment-plugins*.ts`,
`build-config.server.ts`, `core/plugins/{cache,sse,mailer,api-init}/*`, `src/lib/index.ts`,
`src/lib/server.ts`.

## 2. `$rime/<path>/module` made fully lazy

**What**: `resolveId`/`load` in the Vite plugin no longer call `buildRuntimeRegistry()` (a
directory walk) at all. Resolution is on-demand per specifier: check the two local roots
(rime's own dist, the consumer's `src/lib`) via a direct two-file existence check
(`findModulePair`), and if neither has it, hand the specifier straight to Vite's own
`this.resolve()` — which handles an installed third-party package exactly like a normal
`import` would, no `node_modules` scan involved.

**Why**: the registry-scan approach (walk `node_modules` looking for a self-declared flag)
was a supply-chain risk — any installed package, including a transitive one nobody chose
directly, could get silently wired into resolution. Lazy resolution only ever touches the
one package literally named in the specifier being resolved right now — the same scope a
plain `import` already has.

**Why it matters**: third-party field/plugin packages work through the same `$rime/...`
convention as everything else, without rime ever needing to know they exist ahead of time.

**New**: `core/dev/generate/runtime/discovered.server.ts` — when `load()` resolves a
third-party specifier for the first time, it AST-parses the resolved file's export names and
persists them (via the existing dev cache) so a later `rime generate` can emit a precise
(if untyped) `declare module` for it instead of leaving it to the generic `$rime/*` fallback.

**Two real bugs found only by actually running this** (typechecking alone can't catch a
runtime resolution mismatch): `$rime/plugins/cache` doesn't match anything —
`findModulePair` treats the specifier as a literal folder path, and the folder is
`core/plugins/cache/`, not `plugins/cache/`. Same mistake repeated for
`$rime/+config/news/module` — the specifier isn't allowed a `/module` suffix, that's
implied by the file (`module.server.ts`) sitting inside the named folder. Both fixed; the
`fields/relation` naming (no suffix, full real path) was already correct and is now the
one convention everywhere.

## 3. Standalone config mode

**What**: a consumer can now write `src/lib/rime.config.server.ts` directly instead of
`src/lib/+rime/rime.config.ts` (a whole folder, AST-scanned in full). The sanitizer detects
which mode is in use (`isFolderConfig()`, checking whether `src/lib/+rime/` exists) and:

- **Folder mode** (unchanged): walks `+rime/`, AST-splits every file with `$`-prefixed
  content into a client/server pair, mirrors the whole tree into `+rime.generated/`.
- **Standalone mode** (new): AST-sanitizes _only_ `rime.config.ts` — one file, not a folder
  walk — and writes just the client-stripped copy back out as `src/lib/rime.config.ts`, a
  sibling of the real `rime.config.server.ts`. Nothing nested (a collection's hooks, a
  field's `$beforeSave`) gets AST-stripped anymore; those go through `$rime/.../module`
  instead, the same as a plugin's split does.

**Why**: `rime.config.server.ts` is real, hand-authored source — already guaranteed
server-only by SvelteKit's own `.server.ts` convention, no tooling needed for that half at
all. The only _generated_ file is the client copy, and because it's written as a sibling
of the real server file (not into a separate `+rime.generated/` mirror), its relative
imports (`./+config/news/index.js`, etc.) are already correct with nothing to rewrite.

**Why it matters**: for a consumer who doesn't need nested collection files scanned for
`$`-content (most of it now goes through `$rime/.../module` explicitly), this is one file
instead of a folder-plus-generated-mirror pair, and there's meaningfully less sanitizer
code path involved (no `updateServerImports` copy-and-rewrite step, since there's no
duplicate server file to produce).

**`+rime`/`+rime.generated` stay `+`-prefixed on purpose**: a consumer could otherwise
create an ordinary `src/lib/rime/` folder for unrelated reasons and have it mistaken for
folder-mode config, silently AST-parsing whatever's inside. The `+` prefix (matching
SvelteKit's own special-file convention) makes that collision very unlikely.

**Files**: `core/dev/constants.ts` (`isFolderConfig`, `configImportPaths`),
`core/dev/generate/sanitize/index.server.js` (`sanitizeFolder`/`sanitizeStandalone` split),
`core/ensure.server.ts`, `core/dev/vite/index.server.ts` (watcher + hot-reload path),
`core/dev/generate/routes/common.server.ts` (panel/live route templates), `core/dev/cli/init/*`
(`setConfig` skips scaffolding a folder-mode stub if a standalone config already exists;
`hooks.server.ts`'s template is mode-aware), `core/dev/cli/clear/*` (removes the standalone
files too, not just `+rime/`).

## 4. Schema location made mode-consistent

**What**: `src/lib/rime.schema.server.ts` now, unconditionally, in both modes — not
`src/lib/+rime.generated/schema.server.ts`.

**Why**: schema was never actually part of the sanitized-source mirror (the adapter writes
it directly, independent of the config sanitizer) — tying its location to `+rime.generated/`
was never load-bearing, just incidental. In standalone mode that left `+rime.generated/`
holding _only_ the schema file, which was the wrong file living in the wrong-shaped folder
for no real reason.

**Why it matters**: `+rime.generated/` is now purely a folder-mode artifact — absent
entirely in standalone mode, rather than sticking around half-empty for one unrelated file.
`drizzle.config.ts`'s schema path, `ensureSchema()`, the `$rime/schema` declaration, and the
Vite plugin's schema loader all had to move together — they'd drifted out of sync at one
point mid-session (`drizzle-kit generate` failing because `drizzle.config.ts` still pointed
at the old path) and are now the one thing that agrees across all four.

## 5. `tests/basic` migrated to standalone, as the real end-to-end proof

`tests/basic/config/` (a real, git-tracked fixture — not `src/lib/+rime/`, which is a
disposable copy `src/scripts/useConfig.js` generates via `cp -rf`) converted to the
standalone shape: `rime.config.server.ts` at its root, collections moved into `+config/`,
the two collections needing hooks (`news`, `pages`) split into `module.server.ts` +
isomorphic `index.ts` pairs. `useConfig.js` now detects standalone vs folder mode per
fixture (`rime.config.server.ts` present at the fixture root or not) and copies into
`src/lib/` directly vs `src/lib/+rime/` accordingly — both mechanisms now real, working code
paths, not just typechecked but actually exercised via `bun ./src/scripts/useConfig.js basic`.

## 6. Fixture layout renamed to mirror its real destination

**What**: every `tests/<name>/config/` renamed to `tests/<name>/lib/...`, matching whatever
each fixture actually lands at under `src/lib/` — `tests/basic/lib/` now holds
`rime.config.server.ts` + `documents/` directly (its standalone destination is `src/lib/`
itself, no wrapper folder), the folder-mode fixtures (`empty`, `fields`, `multilang`,
`versions`, `versions-multilang`) moved to `tests/<name>/lib/+rime/` (their destination is
`src/lib/+rime/`).

**Why**: with the two fixture shapes previously living side by side under an identically
named `config/` folder, nothing in the path told you which mode a fixture used or where its
contents would actually end up — the `+rime/` folder in the name now does both jobs.

**Why it matters**: `useConfig.js`'s copy step no longer needs to branch on mode at all —
`cp -rf tests/<name>/lib/* src/lib/` is correct for either shape, since the fixture's own
`lib/` subtree is now byte-for-byte what belongs under `src/lib/`. `tsconfig.json`'s
exclude pattern updated from `tests/**/config/**` to `tests/**/lib/**` to match.

## Considered and reverted

Moving `app.generated.d.ts`/`rime.generated.d.ts` out of `src/` entirely (into
`node_modules/.rime`, referenced from `src/` via a one-line triple-slash stub) was explored
and fully reverted. Two real problems surfaced: combining both files into one previously
didn't work (kept them separate once reverted), and `$lib`-aliased import specifiers
embedded in the generated content didn't reliably resolve from a file living outside `src/`,
even though the alias mapping is nominally project-wide. Back to the original: both files
written directly into `src/`, `$lib`-aliased, as before.
