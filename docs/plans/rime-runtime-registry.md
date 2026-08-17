# `$rime/runtime` as a registry, not a sibling-file lookup

Status: not started. Current shipped behavior (0.30.2) uses `optimizeDeps.exclude:
['rimecms', 'rimecms/fields', 'rimecms/panel']` as a stopgap — see
[index.server.ts](../../src/lib/core/dev/vite/index.server.ts) `config()`. That stays
until this lands.

## Why revisit it

`$rime/runtime` currently resolves by taking `path.dirname(importer)` and looking for a
sibling `runtime.ts` / `runtime.server.ts`. That breaks the moment the importing file
goes through Vite's esbuild dep-optimizer: pre-bundling flattens multiple source files
into one chunk, so by the time the dev server rewrites the remaining bare `$rime/runtime`
specifier, `importer` is the chunk file, not the original source — `dirname()` then
points at `node_modules/.vite/deps/`, which has no `runtime.ts`. Excluding `rimecms`,
`rimecms/fields`, `rimecms/panel` from `optimizeDeps` avoids the flattening entirely, at
the cost of those subpaths never getting pre-bundled (see "what `optimizeDeps` buys you"
below for what that actually costs — in practice, not much for this package).

`$rime/config` doesn't have this problem, and not because it points at a "known
location" — because its virtual id (`\0$rime/config`) is **not parameterized by
importer at all**. `load()` only needs `isServer` (from `this.environment`, which is
per-build-pass metadata and survives flattening) to pick between two real package
exports. The fix for `$rime/runtime` is to give it the same property — importer-
independence — without losing per-field colocation.

## Design

Replace the bare `$rime/runtime` specifier with a suffixed, static one:

```ts
// src/lib/fields/relation/index.ts
import { ensureRelationExists } from '$rime/runtime/relation';
// src/lib/fields/link/index.ts
import { populateRessourceURL } from '$rime/runtime/link';
```

The suffix (`relation`, `link`, ...) is a literal string baked into the source. Static
string specifiers survive esbuild flattening untouched — that's exactly the property
that broke before, now working in our favor. `resolveId`/`load` become generic: parse
the suffix, look it up in a registry built once (not per-importer), return a fixed
virtual id, done. No more filesystem math on `importer`.

### The registry

Two concerns to solve, per your notes:

1. **Don't hand-write a `resolveId` branch per field.** For rime's own fields, the
   registry should be auto-derived: at plugin `configResolved`/`buildStart`, glob
   `src/lib/fields/*/runtime.ts` (paired with a required sibling `runtime.server.ts`),
   and register `<dirname>` as the name. Adding a new field with a runtime split means
   adding the two files — nothing else. For consumer-authored fields, mirror the same
   glob convention against a project-relative folder, e.g. `src/lib/+rime/runtime/*/`
   (matches the `+rime`/`+rime.generated` naming already used for
   [INPUT_DIR/OUTPUT_DIR](../../src/lib/core/dev/constants.js)), so no manual config
   entry is needed there either — just drop files in the conventional spot. Fall back
   to an explicit list only if someone needs a name that doesn't match the folder they
   want (unlikely to matter in practice).

2. **Forward types through codegen.** Today both call sites carry
   `// @ts-expect-error` because `$rime/runtime` isn't a real module as far as
   `tsc`/`svelte-check` is concerned. Once the registry exists (built the same way at
   dev-watch time as schema/routes/types already are, per the `server.watcher.on(
   'change', ...)` flow in [index.server.ts](../../src/lib/core/dev/vite/index.server.ts)),
   extend that generation step to also emit ambient module declarations into
   `rime.generated.d.ts` (or a new sibling `runtime.generated.d.ts`), one per
   registered name:

   ```ts
   declare module '$rime/runtime/relation' {
     export * from '../../../fields/relation/runtime.js';
   }
   ```

   Emit against whichever of `runtime.ts` / `runtime.server.ts` — doesn't matter which,
   as long as the two files export the same shape (that's already an implicit
   requirement of the client/server split, since callers can't know which one loaded).
   Regenerate whenever the registry's file list changes, same trigger as
   schema/routes/types.

### Plugin changes

```ts
resolveId(id) {
  if (id.startsWith(`${VRuntimeId}/`)) {
    const name = id.slice(VRuntimeId.length + 1);
    if (!runtimeRegistry.has(name)) return null; // let it fail as a real unresolved import
    return resolvedVModule(id); // \0$rime/runtime/<name> — fixed, no importer
  }
  return null;
}

load(id) {
  const match = /^\0\$rime\/runtime\/(.+)$/.exec(id);
  if (match) {
    const isServer = this.environment?.config?.consumer === 'server';
    const entry = runtimeRegistry.get(match[1]);
    const target = isServer ? entry.server : entry.client;
    return `export * from '${target}';`;
  }
}
```

`runtimeRegistry` built once per config load (glob + cache), not recomputed per
resolve. Unknown names return `null` from `resolveId` so they surface as a normal
"failed to resolve import" error instead of a silent virtual-module 404 — better dev UX
than what we have now either way.

### Payoff

Once resolution no longer depends on `importer`, `rimecms`, `rimecms/fields`, and
`rimecms/panel` can come back out of `optimizeDeps.exclude` — full pre-bundling
eligibility restored, no more tradeoff to explain.

## Migration checklist

- [ ] Build the field-runtime registry (glob `fields/*/runtime.ts` + required
      `runtime.server.ts` pair; error at build time if only one of the pair exists)
- [ ] Same glob for consumer-side `src/lib/+rime/runtime/*/`
- [ ] Generic `resolveId`/`load` keyed off the registry
- [ ] Codegen: ambient `.d.ts` per registered name, wired into the existing
      sanitize → generate cycle
- [ ] Update `relation/index.ts`, `link/index.ts` to `$rime/runtime/relation`,
      `$rime/runtime/link`; drop the `@ts-expect-error` comments
- [ ] Remove `rimecms`, `rimecms/fields`, `rimecms/panel` from `optimizeDeps.exclude`
      (keep `sharp`)
- [ ] Fresh-app smoke test: `rime init` + `vite dev`, load `/panel`, exercise a
      relation field and a link field, confirm no `.vite/deps` 404s, confirm
      `pnpm check` sees real types for both `$rime/runtime/*` imports
- [ ] `vite build` still works (registry must build outside dev-server context too —
      `buildStart` not `configureServer`)
