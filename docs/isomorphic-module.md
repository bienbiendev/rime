# Isomorphic modules — plan

`$rime/modules` works in every repo and breaks in every consumer. This is why, and what replaces it.

Everything marked **verified** below was run against a real consumer app at
`/Users/ai/Dev/_tests/consumer`. Everything else is design.

---

## 1. The bug

A consumer's panel dies in the browser:

```
SyntaxError: The requested module '/node_modules/clone-deep/index.js?v=fe164876'
  does not provide an export named 'default'
```

`clone-deep` is CommonJS. It has no `default` export until a bundler converts it. So the question
is why that file reached the browser unbundled.

### What vite does

The app imports `rimecms`. Vite's scanner records the bare specifier, **stops crawling**, and
esbuild rolls the whole package into one ESM bundle — `clone-deep` converted along the way.
**Verified** in `node_modules/.vite/deps/_metadata.json`:

```
optimized: rimecms, rimecms/fields, rimecms/panel, @lucide/svelte, svelte, …
```

`clone-deep` is not in that list, and should not be. It lives *inside* the `rimecms` bundle.

### What `$rime/modules` does

**Verified** — the virtual module's own output, fetched from the running dev server:

```js
// GET /@id/__x00__/…/node_modules/rimecms%01$rime/modules/rimecms/fields/link
export * from "/node_modules/rimecms/dist/fields/link/module.js?v=fe164876";
```

An **absolute file path**. Vite's optimizer maps bare specifiers to bundles; a file path is just a
file. So this reaches rime's code by a route that has nothing to do with the pre-bundled
`rimecms`, and everything behind it is served as raw source — including its CJS imports.

Two code paths in [`vite.server.ts`](../src/lib/core/dev/vite.server.ts), and that is the whole story:

```ts
pkgName === ownPackageName  → findModulePair(cwd/src/lib, sub)   // project source  ✅
otherwise                   → <pkgRoot>/dist/.rime-modules.json  // node_modules    ❌
```

| who imports | whose pair | resolves to | |
|---|---|---|---|
| rime's own code | rime's own | `src/lib/…` | ✅ |
| plugin's own code | plugin's own | `src/lib/…` | ✅ |
| app's own code | app's own `src/lib` | `src/lib/…` | ✅ |
| app's code | rimecms | `node_modules/rimecms/dist` | ❌ |
| app's code | a plugin | `node_modules/@scope/…/dist` | ❌ |
| plugin's code | rimecms | `node_modules/rimecms/dist` | ❌ |

Every ✅ is a package resolving **itself**, from source. Every ❌ crosses a package boundary. You
only ever developed inside a repo, so you only ever hit the ✅ rows.

### Why it started now, not on develop

`develop` has the same mechanism, byte-identical `exportFrom`, the same absolute path. What
changed is **what walks through the door**. Following runtime imports only (skipping
`import type`, which vanishes at compile time):

```
develop                                 this branch
cache/module.ts     2 files             auth/module.ts     51 files  → clone-deep
link/module.ts      1 file              upload/module.ts   18 files  → clone-deep
relation/module.ts  1 file              nested/module.ts    6 files  → clone-deep
                                        cache/module.ts     2 files
                                        defaults/module.ts  2 files
                                        link/module.ts      1 file
                                        relation/module.ts  1 file
```

Develop's halves were **leaves**. Nothing behind the door, so it did not matter that the door
bypassed the bundler. This branch's halves build fields:

```ts
// core/prototype/collection/nested/module.ts
import { text } from '$lib/fields/text/index.js';   // → form-field-builder → clone-deep
```

---

## 2. Dead ends — do not retry these

| tried | result |
|---|---|
| `optimizeDeps.include: ['clone-deep']` | **verified** — fixes it, then `css.escape` fails next. Endless tail |
| Emit `export * from 'rimecms/upload'` from the virtual module | **verified** — still served raw. Vite's scanner never crawls a virtual module, so the subpath is never registered. *Note the contrast with §4.3: the same string written in a real `dist` file works, because esbuild is already bundling that file* |
| Same, plus `optimizeDeps.include` of the subpath | **verified** — works, but needs `optimizeDeps` |
| `optimizeDeps.include` with absolute paths | **verified** — ignored |
| `resolveId` returning the real resolved file instead of a virtual module | **verified** — identical failure. A `node_modules` file is a file either way; the optimizer maps bare specifiers, not paths |
| Rewrite to a relative path + a `browser` field map | **verified** working, but superseded by §4.3 — one mechanism instead of two, and no reliance on the `browser` field applying to a raw serve |
| Per-environment `resolve.alias` | **verified** — vite has no such option (`EnvironmentResolveOptions` has no `alias`) |
| Pinning vite 8.0.8 instead of 8.3.0 | **verified** — identical failure. Not a vite regression |
| tsconfig `nodenext` vs `bundler` | rime's is `bundler` on both branches; the consumer's is `sv create` scaffolding and never runs at runtime |

---

## 3. Audit — what actually needs it

A site needs the mechanism only when the **importing file is isomorphic** *and* the pair it draws
from has two halves that differ. Four of the thirteen meet neither test.

| importer | isomorphic | pair | needs it |
|---|---|---|---|
| `core/boot.server.ts` — `bootUpload` | no | server-only | **no** |
| `core/plugins/api-init/index.ts` — `apiInit` | no | server-only | **no** |
| `core/plugins/mailer/index.ts` — `mailer` | no | server-only | **no** |
| `core/plugins/sse/index.ts` — `sse` | no | server-only | **no** |
| `core/config/configure.ts` — `configureCors` | yes | server-only | stub only |
| `core/config/configure.ts` — `configureVersions` | yes | server-only | stub only |
| `core/config/configure.ts` — `configureStaff` | yes | both | yes |
| `core/config/configure.ts` — `configureUploadDirectories` | yes | both | yes |
| `core/plugins/cache/index.ts` — `cache` | yes | both | yes |
| `core/plugins/defaults/index.ts` — `defaultPlugins` | yes | both | yes |
| `core/prototype/collection/definition.ts` — `augmentAuth` | yes | both | yes |
| `core/prototype/collection/definition.ts` — `augmentNested` | yes | both | yes |
| `core/prototype/collection/definition.ts` — `augmentUpload` | yes | both | yes |
| `fields/link/index.ts` — `populateRessourceURL` | yes | both | yes |
| `fields/relation/index.ts` — `ensureRelationExists` | yes | both | yes |

"isomorphic" is measured, not guessed: walk the runtime imports (skipping `import type`) from
`index.ts`, `panel/index.ts`, `fields/index.ts` and `config/index.ts`, and see whether the file is
in the graph.

### The four that don't

A `.server.ts` file reaching for a server-only pair is just a server file importing another server
file, dressed up:

```ts
// core/boot.server.ts — today
import { bootUpload } from '$rime/modules';
bootUpload?.(config);          // the `?.` is there because the mechanism might hand back undefined

// what it is (see the rename below)
import { bootUpload } from './prototype/collection/upload/boot/index.server.js';
bootUpload(config);
```

The other three are pure re-export shims whose only job was routing through the barrel:

```ts
// core/plugins/sse/index.ts — the whole file
export { sse } from '$rime/modules';
```

Delete all three. Nothing else imports them.

And once nothing reaches these through `$rime/modules`, the `module.server.ts` name is a lie.
Rename each to what it is:

```
core/plugins/sse/module.server.ts                 → index.server.ts
core/plugins/mailer/module.server.ts              → index.server.ts
core/plugins/api-init/module.server.ts            → index.server.ts
core/prototype/collection/upload/boot/module.server.ts → index.server.ts
```

[`server.ts`](../src/lib/server.ts) then imports `…/sse/index.server.js`, and
[`boot.server.ts`](../src/lib/core/boot.server.ts) imports `…/upload/boot/index.server.js`.

> **The rule this establishes:** the name says **how the file is reached**. `module.ts` /
> `module.server.ts` means "resolved through `$rime/modules`". A file something imports directly
> gets an ordinary name.
>
> Whether the pair is complete has nothing to do with it — a half pair (§6) is still reached
> through the mechanism, so it keeps the name and stays exactly as it is today.

### What that leaves

```
pairs      13 → 9      api-init, mailer, sse and upload/boot stop being pairs —
                       they are plain server modules
sites      13 → 9
```

Of the nine, `configureCors` and `configureVersions` are server-only pairs read from an isomorphic
file, so they need the mechanism *only* for the `undefined` on the client side — see §6.

Do this audit first. It is the cheapest step in the plan and it removes a third of the surface
before any of the rest is written.

---

### The vite plugin

Nothing in [`vite.server.ts`](../src/lib/core/dev/vite.server.ts) is dead **today** — every symbol
has a live caller. What the audit shows is how much of it exists only to serve the bare barrel,
and therefore dies with it.

```
                                                  lines   fate
vite.server.ts                                      444
  exportFrom, splitPackageSpecifier                  24    gone
  moduleIndex, getModuleIndex, moduleRewrites,
  ROOT_SEP, resolvedVModule                          41    gone
  transform hook (the whole hook)                    28    gone
  resolveId, third-party branch                      33    gone
  load, all three $rime/modules branches             85    gone
                                                   ----
                                                    211    ~48% of the file

codegen/runtime/barrel-rewrite.server.ts            283    gone
codegen/runtime/parse-exports.server.ts              61    kept for the stub names only
cli/commands/generate-manifest.server.ts            151    becomes generate-exports
```

What survives, and why:

| kept | because |
|---|---|
| `regenerateModulesDeclaration` | still writes `src/rime.modules.generated.d.ts`, one entry per pair |
| `VCoreId` / `VSchemaId` branches | `$rime/config` and `$rime/schema` are a different mechanism — they point at generated files in the **app's own** `src/`, never into `node_modules`, which is why they have never broken |
| `findModulePair`, `scanModulePairs` | the dev resolve in §4.2, and the prepack scan |
| config watcher, `sanitize`, `ensureHasInit` | unrelated to modules |

`$rime/config` is worth calling out as the counter-example: same virtual-module trick, but its
target is app source, so it lands on a ✅ row of the table in §1.

---

## 4. The shape

Three parts. The path moves into the specifier, dev keeps resolving from source, and prepack
turns every cross-package import into one the bundler already follows.

### 4.1 Syntax — the path is in the specifier

```ts
// today — where does Foo come from? which half am I getting?
import { Foo, Bar } from '$rime/modules';

// instead
import { Foo, Bar } from '$rime/modules:core/auth';
import { Boooz }    from '$rime/modules:../nested';
```

Rooted at `src/lib` unless it starts with `./` or `../`, which is relative to the importer.

This alone fixes the two authoring complaints:

- **Names are per-pair, not per-package.** No global uniqueness, no collision index, no
  "halves export different names" warning.
- **A missing name is an error at that path**, not a silent `undefined` that fails at link time.

### 4.2 Dev — unchanged, and it already works

The plugin resolves the specifier to the real source file for the current environment:

```ts
// vite.server.ts — resolveId
if (id.startsWith('$rime/modules:')) {
  const pair = findModulePair(cwd/'src/lib', subpathOf(id, importer));
  return this.environment?.config?.consumer === 'server' ? pair.server : pair.client;
}
```

It returns a **real path into `src/lib`** — no virtual id, no `\0`. That is the ✅ row: project
source, which the scanner crawls, which is why dev was never broken.

### 4.3 Prepack — rewrite to a self-referencing subpath

**Verified** in the consumer. A bare `<pkg>/<subpath>` import **written into a real `dist` file** is
followed by esbuild while it bundles the package, resolved through `exports`, and **inlined**:

```
SSR                → SERVER half
client bundle      → CLIENT half
optimized entries  → rimecms, rimecms/fields, rimecms/panel     ← no separate entry
```

That third line is the one that matters. The subpath did not become its own optimized entry — it
landed *inside* the `rimecms` bundle, so everything behind it is bundled too, `clone-deep`
included.

This is not the same as the dead end in §2. There, the bare specifier came out of a virtual module
at request time, so esbuild never saw it. Here it is written in a file esbuild is already bundling.
Same string, opposite outcome.

So prepack, running on `dist/`:

```ts
// dist/core/prototype/collection/definition.js — before
import { augmentAuth } from '$rime/modules:core/auth';

// after
import { augmentAuth } from 'rimecms/core/auth/module';
```

```jsonc
// package.json — one entry per pair, generated
"exports": {
  "./core/auth/module": {
    "types":   "./dist/core/auth/module.server.d.ts",
    "browser": "./dist/core/auth/module.js",
    "default": "./dist/core/auth/module.server.js"
  }
}
```

No `browser` field, no relative paths, no manifest at consumer runtime. One mechanism —
`exports` conditions — doing the whole job.

The `/module` suffix keeps a pair's subpath distinct from a public entry that shares its folder:
`rimecms/fields/relation` is the public client entry, `rimecms/fields/relation/module` is the pair.

#### Two things rime's `exports` needs first

**Verified** — both, in the consumer.

```
rime's conditions today:  types, svelte, import      ← no `default`, no `browser`
```

`svelte` is applied by vite-plugin-svelte to **both** environments, so it matches first and
shadows `browser`. Conditions are first-match-wins, so `browser` has to precede it. And with no
`default`, resolving through the exports map fails outright — which
[`vite.server.ts`](../src/lib/core/dev/vite.server.ts) already records as the reason it walks
`node_modules` by hand instead.

Putting `browser` ahead of `svelte` does **not** stop vite-plugin-svelte treating the package as a
Svelte library — **verified**, the panel renders and components still compile.

## 5. Worked example — one pair, end to end

```
src/lib/core/auth/
  module.ts          export { augmentAuth } from './augment.js';
  module.server.ts   export { augmentAuth } from './augment.server.js';
```

```ts
// src/lib/core/prototype/collection/definition.ts
import { augmentAuth } from '$rime/modules:core/auth';
```

**Dev, in rime's repo** — `resolveId` answers from source:

```
client build → src/lib/core/auth/module.ts
ssr build    → src/lib/core/auth/module.server.ts
```

**Prepack** — rewritten in `dist`, plus one `exports` entry:

```js
// dist/core/prototype/collection/definition.js
import { augmentAuth } from 'rimecms/core/auth/module';
```
```jsonc
"./core/auth/module": {
  "types":   "./dist/core/auth/module.server.d.ts",
  "browser": "./dist/core/auth/module.js",
  "default": "./dist/core/auth/module.server.js"
}
```

**In a consumer** — vite pre-bundles `rimecms`; esbuild follows the self-reference, resolves it
through `exports` under the environment's conditions, and inlines the right half. `clone-deep`
is converted along the way. Nothing is served raw.

---

## 6. Half pairs

Half pairs stay as they are — `undefined` on the missing side. The only change is that the stub
becomes a real file, since a condition has to name one. `parseExportNames` already computes the
names.

| pair | `browser` | `default` |
|---|---|---|
| both halves | `module.js` | `module.server.js` |
| client only | `module.js` | `module.js` |
| server only | generated `module.browser.js` | `module.server.js` |

```js
// dist/core/cors/module.browser.js — generated at prepack
export const configureCors = undefined;
```

Rime's thirteen pairs today:

```
both halves (7)   core/auth              core/plugins/cache      core/plugins/defaults
                  core/prototype/collection/nested                core/prototype/collection/upload
                  fields/link            fields/relation

server only (6)   core/cors              core/plugins/api-init   core/plugins/mailer
                  core/plugins/sse       core/prototype/collection/upload/boot
                  core/prototype/shared/versions
```

---

## 7. Migration

### Step 1 — specifier
Teach `resolveId` the `$rime/modules:<path>` form, rooted at `src/lib`, `./`/`../` relative to the
importer. Keep the bare `$rime/modules` form working alongside it so nothing breaks mid-migration.

### Step 2 — rewrite the call sites
Thirteen imports across ten files:

```
core/boot.server.ts                        bootUpload
core/config/configure.ts                   configureCors, configureStaff,
                                           configureUploadDirectories, configureVersions
core/plugins/api-init/index.ts             apiInit
core/plugins/cache/index.ts                cache
core/plugins/defaults/index.ts             defaultPlugins
core/plugins/mailer/index.ts               mailer
core/plugins/sse/index.ts                  sse
core/prototype/collection/definition.ts    augmentAuth, augmentNested, augmentUpload
fields/link/index.ts                       populateRessourceURL
fields/relation/index.ts                   ensureRelationExists
```

Plus the fixture's own app-level pairs, `+rime/news/index.ts` and `+rime/pages/index.ts` — the
app-resolves-its-own-`src/lib` case, which needs the new specifier but no other change.

### Step 3 — prepack
`generate-manifest.server.ts` → `generate-exports.server.ts`:

- keep `scanModulePairs(dist)`
- rewrite each `$rime/modules:<path>` to `<pkg>/<subpath>/module`
- write one `exports` entry per pair into `package.json`
- fix the pre-existing entries: add `default`, move `browser` ahead of `svelte`
- generate `module.browser.js` stubs for server-only pairs
- **stop shipping** `.rime-modules.json` and `.rime-modules.d.ts` — the manifest is build-time
  only now, and a rewritten `.d.ts` resolves `<pkg>/<subpath>/module` through that entry's
  `types` condition like any other import, so the `/// <reference path=…>` prepending goes too

### Step 4 — delete the bare barrel
Once every call site carries a path:

```
resolveId   third-party branch, ROOT_SEP, findInstalledPackageRoot
load        bare-barrel backstop, self-reference branch, third-party branch, exportFrom
transform   the whole hook
            buildModuleIndex, planBarrelRewrite, applyEdits
            parse-exports.server.ts   (except the stub-name computation prepack still needs)
```

### Step 5 — the two packages
`@rimecms/test-consumer-plugin` and `@rimecms/test-consumer-field`: rewrite their call sites to
the new specifier. `prepack: rime package` picks up the new generator with no further change.

### Step 6 — docs
`06-guides/02-isomorphic-modules.md` is the substantive rewrite; `03-plugin-authoring.md` and
`04-authoring-a-package.md` next; passing mentions in `05-fields/00-overview.md` and
`03-configuration/00-overview.md`.

---

## 8. Verification

In order, because the cheap ones catch the most:

```
bun run check          expect 9 on the basic fixture
bunx vitest run         191
bunx eslint src/lib
bunx madge -c --extensions ts ./src/     3 circular
golden schema diff      byte-identical
bun run test:basic      92 passed / 5 mail_error (no SMTP in env)
bun run test:versions   54
src/scripts/local-pack-test.sh
```

The pack test is the only gate that exercises a ❌ row. Every other gate runs inside a repo, which
is exactly why this shipped broken.

---

## 9. Open

- **Types in dev.** `$rime/modules:<path>` needs one `declare module` per pair in
  `src/rime.modules.generated.d.ts`, pointing at the server half — the superset, since a pair's
  halves share their names and a server-only name exists nowhere else. Straightforward, but not
  yet written.
- **Non-isomorphic pairs** (client-only, server-only as *authored intent* rather than accident)
  are covered by the table in §5, but nothing enforces which one an author meant. A pair that
  loses a half silently changes category.
