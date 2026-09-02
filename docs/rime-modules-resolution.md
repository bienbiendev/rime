# `$rime/modules`: what resolves, and when

`$rime/modules` is a virtual barrel. Vite scans every `module.ts` / `module.server.ts` pair under
`src/lib` and re-exports whichever side matches the build being made, so one import specifier
serves both — see `scanModulePairs` and `exportFrom` in `core/dev/vite.server.ts`.

The whole of its behaviour is one function, and it is worth reading before the table:

```ts
function exportFrom(entry, isServer) {
  const target = isServer ? entry.server : entry.client;
  if (target) return `export * from '${target}';`; // ① the side exists

  const other = isServer ? entry.client : entry.server;
  if (!other) return '';
  return parseExportNames(other) // ② the side was never authored
    .map((name) => `export const ${name} = undefined;`)
    .join('\n');
}
```

Two branches, and everything below follows from which one you land in:

- **①** the requested side exists → the barrel re-exports **only that file's** names.
- **②** the requested side was never authored → the barrel declares the _other_ side's names and
  sets each to `undefined`.

The trap is that ② is not a fallback for ①. Stubbing happens only when a side is **entirely
absent**, never to fill a gap between two halves that exist.

---

## The cross tables

A pair has three possible shapes — both halves, server half only, client half only — and the
first splits in two depending on whether a name is declared on both sides. Four cases, each shown
with what this repo actually contains.

### A. Both halves, same names on each side — the intended shape

`core/features/upload/module.ts` and `module.server.ts` both export `augmentUpload`.
`fields/link` does the same with `populateRessourceURL`, `fields/relation` with
`ensureRelationExists`, `features/nested` with `augmentNested`.

| binding                | declared in | server build resolves to                                  | client build resolves to      |
| ---------------------- | ----------- | --------------------------------------------------------- | ----------------------------- |
| `augmentUpload`        | both halves | `module.server.ts` — fields **+ the `_path` foreign key** | `module.ts` — the fields only |
| `populateRessourceURL` | both halves | `fields/link/module.server.ts`                            | `fields/link/module.ts`       |

One name, one import, two implementations. Nothing to think about.

### B. Both halves, but a name only one side declares

`core/plugins/cache/module.ts` exports `cache`. `module.server.ts` exports `cache`, `toHash` and
the type `CacheActions`.

| binding        | declared in | server build resolves to | client build resolves to |
| -------------- | ----------- | ------------------------ | ------------------------ |
| `cache`        | both halves | the server plugin        | the client plugin        |
| `toHash`       | server only | the real function        | **not exported at all**  |
| `CacheActions` | server only | (a type; erased)         | **not exported at all**  |

Because a client half exists, the client build takes _its_ export list and stops there — `toHash`
is not stubbed, it is absent. This is legal and `cache` ships this way: nothing client-side
imports `toHash`, so nothing ever asks the barrel for it. It becomes a build failure the moment
something client-reachable writes `import { toHash } from '$rime/modules'`.

That is exactly what broke: `features/upload/index.ts` is loaded by both builds and imported
`uploadHooks`, which only `module.server.ts` declared.

### C. Server half only — no `module.ts`

`features/url`, `features/upload/hooks`, `features/nested/hooks`, `plugins/sse`,
`plugins/mailer`, `plugins/api-init`.

| binding       | declared in                              | server build resolves to | client build resolves to              |
| ------------- | ---------------------------------------- | ------------------------ | ------------------------------------- |
| `urlHooks`    | `features/url/module.server.ts`          | the real object          | `undefined`                           |
| `uploadHooks` | `features/upload/hooks/module.server.ts` | the real object          | `undefined`                           |
| `bootUpload`  | `features/upload/hooks/module.server.ts` | the real function        | `undefined`                           |
| `sse`         | `plugins/sse/module.server.ts`           | the real plugin          | `undefined`                           |
| `SSEActions`  | `plugins/sse/module.server.ts`           | (a type; erased)         | `export const SSEActions = undefined` |

With no client half to prefer, branch ② fires and every name is declared and set to `undefined`.
The client can import them safely; it just must not use them. This is the shape server-only code
wants, and the reason `features/url` worked from the day it was written while `uploadHooks` did
not — until it moved out of a pair that had a client half and into its own server-only module.

### D. Client half only — no `module.server.ts`

The mirror of C, and **there is not one instance of it in this repo**. Worth knowing the shape
anyway, because nothing warns you: a hypothetical `fields/color/module.ts` exporting
`formatSwatch` and no server half would give the server build `formatSwatch === undefined`. Server
code importing it gets no error, just a value that is not there.

### All four shapes, side by side

| pair shape                       | example                   | server build          | client build          |
| -------------------------------- | ------------------------- | --------------------- | --------------------- |
| both halves, name in both        | `augmentUpload`           | server implementation | client implementation |
| both halves, name in server only | `toHash`                  | server implementation | **not exported**      |
| both halves, name in client only | _(none in repo)_          | **not exported**      | client implementation |
| `module.server.ts` only          | `urlHooks`, `uploadHooks` | server implementation | `undefined`           |
| `module.ts` only                 | _(none in repo)_          | `undefined`           | client implementation |

### The two failure modes are not the same

They fail at different times and read completely differently:

- **Not exported** (row 2, client column). ESM binds named imports statically, so the importing
  module fails at link time, before any of its code runs:

  ```
  SyntaxError: The requested module '$rime/modules'
    does not provide an export named 'uploadHooks'
  ```

- **Exported as `undefined`** (rows 3 and 4). Nothing throws. The name exists, the value is
  `undefined`, and you find out wherever it was eventually used — which may be nowhere, which is
  the point of ②, or may be a feature that silently stops contributing hooks.

---

## The rules that fall out

**1. A name that isomorphic code imports must exist on both sides.** Either declare it in both
halves, or put it in a module with no counterpart so ② stubs it. The rule is about the _importer_,
not the pair: `core/plugins/cache` exports `toHash` from `module.server.ts` only, beside a
`module.ts`, and that is fine — nothing client-side imports `toHash`. Asymmetry is legal, and
`rime generate-manifest` logs it at debug rather than failing.

**2. Server-only names belong in a module with no client half.** This is why
`features/url/module.server.ts` worked from the day it was written, and why `uploadHooks` and
`nestedHooks` had to move out of pairs that had client halves into
`features/upload/hooks/module.server.ts` and `features/nested/hooks/module.server.ts`.

**3. Never export a type from a module file.** `parseExportNames` does not check `exportKind`, so
`export type Foo = …` is collected like any other name and stubbed as `export const Foo = undefined`
on the missing side. Harmless while nothing imports it as a value, and confusing the moment
something does. Types belong in a `types.ts` beside the pair — which is why upload's
`WithNormalizedUpload` lives there.

**4. Export names are unique across the whole package.** Every pair lands in one barrel.
`generate-manifest` makes this a hard error at prepack — `"foo" exported by both a and b` — because
a rewritten import would have no single correct target. Hence `augmentUpload`, `uploadHooks`,
`bootUpload`; never a bare `augment` or `hooks`.

---

## The cycle rule

The barrel re-exports the _whole package_, so importing it can pull a module that leads back to
the importer. A feature is the clearest case:

```
features/upload/index.ts
  → $rime/modules  (the barrel, every pair)
      → features/upload/directories/module.server.ts
          → operations/pipeline.server.ts
              → features/registry.ts
                  → features/upload/index.ts        ← back where we started
```

The definition is therefore evaluated _inside_ the cycle, and which of its own modules the barrel
has reached by then is an accident of scan order. Read a binding at module scope and you get
whatever it happens to be at that instant:

```ts
import { augmentUpload, uploadHooks } from '$rime/modules';

export const upload = defineFeature({
  augment: augmentUpload, // module reached already → the real function
  hooks: uploadHooks // module not reached yet → undefined, captured forever
});
```

Read it inside a function and the cycle has long resolved by the time it runs:

```ts
export const upload = defineFeature({
  augment: (config) => augmentUpload(config),
  boot: (config) => bootUpload(config),
  hooks: () => uploadHooks // `hooks` accepts a thunk for exactly this reason
});
```

Worth knowing how this one presents, because it is quiet: with `augment` surviving and `hooks`
`undefined`, the generated schema was byte-identical to the golden file, every adapter probe
matched, and the only symptom was `expect(doc.filename).toBe('landscape-3.jpg')` receiving `null`
in one e2e suite. A green schema diff does not mean a feature is wired up.

---

## Checking it

`madge` cannot see any of this — `$rime/modules` is virtual, so `check:circular-deps` will not
report the cycle above. Three things do catch it:

- `bun run check` — the missing-export case, as a type error on the import.
- Loading the panel in a browser and failing on console errors — the client-bundle case, which is
  otherwise invisible server-side.
- The e2e suites — the `undefined`-binding case, which only shows up in behaviour.
