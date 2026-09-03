import type { PrototypeDefinition, RegisteredPrototype } from './define.js';
import { area } from './area/index.js';
import { collection } from './collection/index.js';

/**
 * The prototype registry, isomorphic half.
 *
 * A definition's **name is its export name here**, so there is no field to keep in sync with the
 * key, and adding a kind is adding a folder and an export.
 *
 * It can live on this side at all because a definition is a `$rime/modules` pair now: the client
 * build gets the half without `api` and `rest`. That matters because the config factory runs on
 * both sides and needs each prototype's `features` list — which used to be unreachable from a
 * client build, back when the definition was a single `.server.ts` file.
 */
export const protos = { collection, area };

export { area, collection };

export type PrototypeName = keyof typeof protos;

/**
 * Every registered prototype. What the whole-config feature steps iterate.
 *
 * **Annotated, not inferred**, and that is load-bearing — the same rule `Rime` follows in
 * rime.server.ts. `augmentConfig` passes this list to `configureWithFeatures`, so inferring it
 * makes `BuildConfig` depend on each definition's `features`, hence on every feature's hooks,
 * each of which is typed through `event.locals.rime` → `Rime` → `BuildConfig`. That closes the
 * loop and TypeScript answers `any` for all of them. A declared type is resolved lazily by name,
 * so the loop never forms.
 */
export const prototypes: RegisteredPrototype[] = Object.entries(protos).map(
  // As registry.server.ts: each definition is written against its own config kind and a list
  // cannot hold both and stay iterable.
  ([name, definition]) => ({ ...(definition as PrototypeDefinition), name })
);
