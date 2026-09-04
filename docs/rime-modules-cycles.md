# Why a `$rime/modules` import can be `undefined`, and how to stop it

> **Status: applied** (commit 6, `0fa7f49`). There is no barrel any more — `transform` in
> `core/dev/vite.server.ts` rewrites every bare `$rime/modules` import into an import of the one
> pair that declares each name, and the resolver throws if a bare specifier ever reaches it
> unrewritten. The wrappers are gone: `upload/index.ts` reads `augment: augmentUpload`, no arrow.
> 24 `module.(server.)ts` files under `src/lib`, 21 import sites, all bare. The document below is
> the diagnosis that produced the fix and the reasoning for its shape; read it when a
> `$rime/modules` import comes back `undefined` again.

A feature's definition had to wrap every binding it took from `$rime/modules` in a function:

```ts
export const upload = defineFeature({
  augment: (config) => augmentUpload(config), // not `augment: augmentUpload`
  hooks: () => uploadHooks // not `hooks: uploadHooks`
});
```

That is a workaround, and it should not be the price of using a runtime module. This is what
actually causes it, and what removes it.

---

## The root issue

**The bare `$rime/modules` specifier is a whole-package barrel.** In dev, `load()` for it does:

```ts
const pairs = scanModulePairs(path.resolve(process.cwd(), 'src/lib'));
return Array.from(pairs.values())
  .map((entry) => exportFrom(entry, isServer))
  .join('\n');
```

Every `module.ts` / `module.server.ts` pair in the project, re-exported from one module. So a file
that wants a single binding from a single pair imports _all of them_, and everything they import,
transitively.

That is fine until one of those modules leads back to the importer. Then the importer is being
evaluated inside an import cycle, and a binding read at module scope is whatever it happens to be
at that instant — which for a module the barrel has not reached yet is `undefined`.

Concretely, what upload hit:

```
features/upload/index.ts
  → $rime/modules                                   ← pulls every pair in the package
      → features/upload/directories/module.server.ts
          → operations/pipeline.server.ts
              → features/registry.ts
                  → features/upload/index.ts        ← back where we started
```

`augmentUpload` survived only because `upload/module.server.ts` sits earlier in the scan order than
`upload/directories/module.server.ts`; `uploadHooks` and `bootUpload` did not, and were captured as
`undefined`. Scan order is the only thing separating the two.

Note what is _not_ the cause. It is not the mutual dependency between the feature and the pipeline —
that is a real relationship, and ESM handles genuine cycles fine as long as nothing reads a binding
before it is initialised. The barrel is what turns "upload's `configure` needs the pipeline" into
"upload's _definition_ transitively imports every module in the package".

---

## It is a dev-only problem

The barrel does not survive packaging. `rime generate-manifest` walks `dist/` and rewrites every
bare import into one qualified import per split actually used:

```ts
import { augmentUpload, uploadHooks } from '$rime/modules';
// becomes, in dist/
import { augmentUpload } from '$rime/modules/rimecms/core/features/upload';
import { uploadHooks } from '$rime/modules/rimecms/core/features/upload/hooks';
```

A published consumer therefore has fine-grained imports and none of this. The wrappers are paying,
at runtime, for a convenience that exists only while developing.

---

## The qualified form already works, and removes the need for wrappers

`resolveId` special-cases a self-reference — `$rime/modules/<own package>/<subpath>` resolves through
`findModulePair`, a single pair, no barrel:

```ts
if (pkgName === ownPackageName) {
  return resolvedVModule(id); // load() resolves it directly off this project's own src/lib
}
```

Measured, on this repo: rewriting upload's definition to the qualified form and **deleting all four
wrappers** leaves everything bound correctly — the generated schema keeps its upload fields and
directories tables (so `augment` and `configure` are live), `static/medias` is created (`boot`), and
a real `POST /api/medias` comes back with `filename: 'probe-exp.jpg'`, `mimeType: 'image/jpeg'`
(`hooks`). That last one is the assertion that failed when the binding was `undefined`.

```ts
import { augmentUpload } from '$rime/modules/rimecms/core/features/upload';
import { bootUpload, uploadHooks } from '$rime/modules/rimecms/core/features/upload/hooks';
import { configureUploadDirectories } from '$rime/modules/rimecms/core/features/upload/directories';

export const upload = defineFeature({
  augment: augmentUpload, // no wrapper
  configure: configureUploadDirectories,
  boot: bootUpload,
  hooks: uploadHooks
});
```

Two reasons this is not yet the committed form:

1. **It writes the package's own name into its own source.** `rimecms` appears in three import
   paths, and a consumer app doing the same would have to write its own package name. That is a
   worse rule to teach than the wrapper it replaces.
2. **The packaged path is unverified.** Reading `generate-manifest`, an already-qualified import is
   left alone (the rewrite matches the bare specifier exactly) and should resolve through the
   third-party branch against `dist/.rime-modules.json`. Should, not verified — and this is a
   published library.

---

## The fix that removes the limitation for everyone

Teach the plugin a **self-reference shorthand**, so a module can name one pair without naming its
own package. Today `splitPackageSpecifier` reads the first segment as a package name, so
`$rime/modules/core/features/upload` resolves `core` as a package and fails. A leading marker would
disambiguate it — for example:

```ts
import { augmentUpload } from '$rime/modules/./core/features/upload';
```

`resolveId` would treat a `.`-prefixed subpath as own-project and hand it straight to
`findModulePair`, which is the code path the qualified self-reference already uses. `resolveId`
also receives `importer`, so resolving the subpath relative to the importing file is available too
if a relative form reads better.

That change is small, contained to `resolveId`/`load` in `core/dev/vite.server.ts`, and it makes
the wrappers unnecessary without asking anyone to hardcode a package name. It also makes every
runtime module cheaper: one pair imported instead of all of them.

**Until then**, the rule is narrow rather than universal, and worth stating precisely so it is not
applied everywhere out of caution: wrappers are only needed when a module's own pair is reachable
from the barrel _back to the file doing the importing_. That is true for features, because
`features/registry.ts` imports them and the pipeline imports the registry. It is not true for
`fields/link` or `core/plugins/cache`, which nothing in the barrel imports back — those read their
bindings at module scope and always will.

---

## How to tell you have hit it

`madge` cannot see it: `$rime/modules` is virtual, so `check:circular-deps` stays green. Nor does
`bun run check` — the binding exists and is typed, it is only `undefined` at runtime.

The symptom is a value that is silently absent. When it bit upload, the generated schema was
byte-identical to the golden file and every adapter probe matched; the only evidence was one e2e
assertion receiving `null` for a filename. If a feature seems to contribute nothing while its
definition looks right, check whether its module is reachable from the barrel back to itself.
