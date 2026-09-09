# Less abstraction in `prototype/`

**Done.** Stage 1 is `8bb0ccb6`, Stage 2 the commit after it. What follows is the plan as written,
with an outcome section at the end.

The decoupling worked; what it cost is legibility. `core/prototype/` has no visible entry point,
and `prototypeNames` / `protos` / `prototypes` are three views of the same two objects.

Same move as the hook order: **replace derivation with what is written.** Feature isolation, the
adapter knowing no kinds, and a prototype composing features all stay. What goes is the machinery
that let core avoid ever writing the words `collection` and `area`.

## What goes

| goes                                                   | replaced by                                  |
| ------------------------------------------------------ | -------------------------------------------- |
| `prototypeNames`, `protos`, `prototypes` (both halves) | `import { collection, area }`                |
| `prototypeEntries`, `prototypeConfigs`                 | `config.collections` / `config.areas`        |
| `prototype/index.server.ts`                            | server callers name `*/definition.server.js` |
| `prototype/hooks.server.ts` (`prototypeHooks`)         | `collectionHooks` / `areaHooks` by name      |
| `prototype/register.ts` + spec                         | `Config` names its two lists                 |
| `configureWithPrototypes`, both `configure` props      | two `?? []` lines in the config chain        |
| `configCtx.byPrototype`                                | the two lists                                |
| `RegisteredPrototype`, `$InferAccessor`                | `PrototypeDefinition`                        |

The `@decouple` comments in `config/index.ts`, `config/index.server.ts` and
`config/context.server.ts` ask for exactly the abstraction being removed. They go with it.

## Stage 1 — the registry becomes two imports

```ts
// prototype/index.ts
export { collection } from './collection/index.js';
export { area } from './area/index.js';
```

**`prototypeEntries` needs no replacement.** All five callers touched `entry.prototype` for
`features` and nothing else — the pairing existed because each had merged the two lists first and
then needed to know which was which. Stop merging them and the question does not arise:

```ts
for (const c of config.collections) shadowOf(collection.features, c);
for (const a of config.areas) shadowOf(area.features, a);
```

Two of the five already split back apart by `config.type` further down
(`codegen/types/index.server.ts`), and one built a map it only ever read for collections
(`codegen/types/templates.server.ts`). `prototypeConfigs` has no callers at all.

`adapter-sqlite/generate-schema` is the one that would duplicate a long loop body. It pairs
locally, three lines at the top of the function, and stays one loop.

Callers holding definitions rather than configs: `boot.server.ts`, `rime.server.ts` (accessors as a
written literal, still cast `as PrototypeAccessors` — that cast is the rule 1 boundary),
`handlers/routes.server.ts`, `codegen/routes/index.server.ts`, `pipeline/prototypes.server.ts`.

Two placement constraints:

- **`index.server.ts` is deleted, not reduced.** Two files exporting `collection` under one name
  meaning different objects is the weirdness itself. One `index.js` for the isomorphic halves; the
  four server callers name `collection/definition.server.js` and the path says which half.
- **No `collection/index.server.ts`.** A barrel over `definition.server.js` and `hooks.server.ts`
  drags the module-scope `{ ...base }` spread into every importer of the hook list — the failure
  rule 3 is written about. Hooks stay imported by path.

## Stage 2 — `Config` says `collections` and `areas`

`config/types.ts` names both members directly; both types are already declared in that file, so no
import and no new edge. Delete `prototype/register.ts`, its spec, and `configure` from both
definitions — the two `?? []` defaults are written where the chain runs (rule 6, third point).

The chain stays a literal sequence, which `config/inference.spec.ts` guards.

## Gates

`check` on the current fixture (rule 5), `vitest`, `eslint src/lib`, `check:circular-deps` (3),
golden schema, `hooks.generated.md` byte-identical.

Stage 1 is runtime, Stage 2 is types — separately, so a `check` delta has one possible cause.
Stage 2 must land on its exact baseline: a delta there means a slug literal stopped narrowing.

The chart is the gate that matters on Stage 1. Rule 3's story is a definition silently losing its
`features` with every static gate green.

## Not in scope

`singleton`, the adapter contract, any feature seam, and `docs/decoupling.md` §7.

---

## Outcome

Both stages landed. Two things came out of doing it that the plan did not predict.

**`HookTiming` and `AnyHook` were still on `FeatureDefinition`.** A timing was a feature's
vocabulary while features carried their own hook lists; they stopped when the order became
written. Both moved to `pipeline/types.ts` in Stage 1.

**Rule 4's boot guard does not exist.** Three places said `buildPipeline` "refuses to boot if a
feature contributes a hook no prototype places" — CONTRIBUTING, and both `hooks.server.ts` files.
There is no such check, and there is nothing left to write one against: a feature carries no hook
list any more. So a hook a feature owns and no prototype places simply never runs, silently. The
claim is now stated as the gap it is, in all three places.

`getByPrototype` went too. Its only callers were the two accessors, and `getCollection` /
`getArea` already existed and threw the same way.

### Gates

| gate                                                         | Stage 1             | Stage 2                 |
| ------------------------------------------------------------ | ------------------- | ----------------------- |
| `check` (basic fixture)                                      | 13 — baseline       | 13 — baseline           |
| `vitest`                                                     | 185                 | 182 (register.spec cut) |
| `eslint src/lib/core`, adapter                               | clean               | clean                   |
| `check:circular-deps`                                        | 3                   | 3                       |
| generated schema, types, routes, param matchers, hooks chart | byte-identical      | byte-identical          |
| `test:basic`                                                 | 92 passed, 5 failed | 92 passed, 5 failed     |

The five e2e failures are the API-key tests, and they are environmental: creating an API key
requires SMTP by design (`Can't create API KEY without smtp config`, then a real `sendMail`), and
the configured host refuses connections — `ECONNREFUSED 193.70.18.144:465`, confirmed with a
direct `transport.verify()`. Same five before and after both stages.

## Still open

- `adapter-sqlite/registry.server.ts` and whether the adapter should know `collection` and `area`
  rather than `singleton: boolean`.
- `pipeline/build-pipeline.server.ts` — three exports, one of them a four-line wrapper, one of them
  codegen's only, and a stale doc block describing a function that is not the one below it.
