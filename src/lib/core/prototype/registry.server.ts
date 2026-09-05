import type { PrototypeDefinition, RegisteredPrototype } from './define.js';
import { area } from './area/definition.server.js';
import { collection } from './collection/definition.server.js';
import type { PrototypeName } from './registry.js';

/** Server-side prototypes: the halves carrying `api`, `rest` and `boot`. */
const protos = { collection, area } satisfies Record<PrototypeName, unknown>;

/**
 * The prototype registry — "Protos".
 *
 * A definition **declares its own name** and is exported here under it. `config.type` on a built
 * config is that same name — `definePrototype` stamps it there — which is what matches a config
 * to its definition.
 */
export { area, collection };

export type { PrototypeName };

/**
 * The accessors the definitions contribute to `event.locals.rime` — `rime.collection(slug)`,
 * `rime.area(slug)`.
 *
 * Read off each definition's `$InferAccessor`, so a new kind brings its own accessor typing with
 * it rather than needing a line added here. What a mapped type cannot do is *build* those
 * signatures: each carries its own slug literals and document types, which only the definition
 * knows. That is why the phantom exists at all.
 */
// Type-only, and read from `api.server.ts` rather than off the definition — which is a
// correctness requirement, not a preference. `App.Locals['rime']` is built from these, and a
// definition now carries its own hooks; a hook is typed through `HookContext`, which reaches
// `event.locals.rime`. Reading the accessor off the definition therefore made every hook's type
// depend on itself, and TypeScript answered `any` for all of them. `api.server.ts` imports no
// hooks, so taking the accessors straight from it cuts the loop.
// `PrototypeAccessors` moved to ./accessors.server.ts — it is named by `RimeContext`, so
// anything it imports lands in every hook's type graph. See the note there.
export type { PrototypeAccessors } from './accessors.server.js';

/** Every registered prototype, each carrying the name it declares and is exported under. */
// Each definition is written against its own config kind — area's boot takes a BuiltArea — and
// the registry erases that, because a list cannot hold both and still be iterable. `satisfies`
// above keeps the set of names closed without widening each definition to the erased shape.
// It is sound for the one reason boot.server.ts encodes: a definition is only ever handed configs
// whose `type` is the name it is registered under.
export const prototypes: RegisteredPrototype[] = Object.values(protos).map(
  (definition) => definition as PrototypeDefinition
);

export const getPrototype = (name: string): RegisteredPrototype | undefined =>
  prototypes.find((prototype) => prototype.name === name);
