import type { PrototypeDefinition, RegisteredPrototype } from '../define.js';
import { area } from './area.js';
import { collection } from './collection.js';

/**
 * The prototype registry — "Protos".
 *
 * A definition's **name is its export name here**, so there is no field to keep in sync with the
 * key, and adding a kind is adding an export. `config.type` on a built config is that same
 * name, which is what matches a config to its definition.
 */
const extensions = { collection, area };

export { area, collection };

export type PrototypeName = keyof typeof extensions;

/** Every registered prototype, each carrying the name it is exported under. */
// Each definition is written against its own config kind — area's boot takes a BuiltArea — and
// the registry erases that, because a list cannot hold both and still be iterable. The cast is
// sound for the one reason boot.server.ts encodes: a definition is only ever handed configs
// whose `type` is the name it is registered under.
export const prototypes: RegisteredPrototype[] = Object.entries(extensions).map(
  ([name, definition]) => ({ ...(definition as PrototypeDefinition), name })
);

export const getPrototype = (name: string): RegisteredPrototype | undefined =>
  prototypes.find((prototype) => prototype.name === name);
