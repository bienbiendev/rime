import { area } from './area/index.server.js';
import { collection } from './collection/index.server.js';
import type { PrototypeDefinition, RegisteredPrototype } from './define.js';

/**
 * The prototype registry — "Protos".
 *
 * A definition's **name is its export name here**, so there is no field to keep in sync with the
 * key, and adding a kind is adding a folder and an export. `config.type` on a built config is
 * that same name, which is what matches a config to its definition.
 */
const protos = { collection, area };

export { area, collection };

export type PrototypeName = keyof typeof protos;

/**
 * The accessors the definitions contribute to `event.locals.rime` — `rime.collection(slug)`,
 * `rime.area(slug)`.
 *
 * Read off each definition's `$InferAccessor`, so a new kind brings its own accessor typing with
 * it rather than needing a line added here. What a mapped type cannot do is *build* those
 * signatures: each carries its own slug literals and document types, which only the definition
 * knows. That is why the phantom exists at all.
 */
export type PrototypeAccessors = {
  [Name in PrototypeName]: (typeof protos)[Name]['$InferAccessor'];
};

/** Every registered prototype, each carrying the name it is exported under. */
// Each definition is written against its own config kind — area's boot takes a BuiltArea — and
// the registry erases that, because a list cannot hold both and still be iterable. The cast is
// sound for the one reason boot.server.ts encodes: a definition is only ever handed configs
// whose `type` is the name it is registered under.
export const prototypes: RegisteredPrototype[] = Object.entries(protos).map(
  ([name, definition]) => ({ ...(definition as PrototypeDefinition), name })
);

export const getPrototype = (name: string): RegisteredPrototype | undefined =>
  prototypes.find((prototype) => prototype.name === name);
