import type { PrototypeDefinition, RegisteredPrototype } from './define.js';
import { area } from './area/definition.server.js';
import { collection } from './collection/definition.server.js';
import type { PrototypeName } from './index.js';

/**
 * The server halves — the ones carrying `api`, `rest` and `boot`.
 *
 * The isomorphic halves are in `./index.js`, under the same two names. Neither file re-exports
 * them: an importer names the half it wants by naming the file it comes from, because `area` from
 * one and `area` from the other are different objects and the name alone could not say which.
 */
const protos = { collection, area } satisfies Record<PrototypeName, unknown>;

export type { PrototypeName };

/**
 * What `rime.collection(slug)` and `rime.area(slug)` are typed as.
 *
 * Re-exported from accessors.server.ts, which takes them from `api.server.ts` rather than off the
 * definitions — a correctness requirement. `App.Locals['rime']` is built from these, and a hook is
 * typed through `HookContext` → `event.locals.rime`; reading the accessor off a definition, which
 * carries hooks, made every hook's type depend on itself and TypeScript answered `any`.
 * `api.server.ts` imports no hooks, so it cuts the loop.
 */
export type { PrototypeAccessors } from './accessors.server.js';

/**
 * Every registered prototype.
 *
 * Each definition is written against its own config kind — area's `boot` takes a `BuiltArea` — and
 * a list cannot hold both and stay iterable, so the cast erases that. `satisfies` above keeps the
 * set of names closed without widening each definition. Sound for the reason boot.server.ts
 * encodes: a definition is only ever handed configs whose `type` is the name it is registered
 * under.
 */
export const prototypes: RegisteredPrototype[] = Object.values(protos).map(
  (definition) => definition as PrototypeDefinition
);
