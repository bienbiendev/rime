import type { AreaAccessor } from './area/api.server.js';
import type { CollectionAccessor } from './collection/api.server.js';

/**
 * The accessors each prototype contributes to `event.locals.rime` — `rime.collection(slug)`,
 * `rime.area(slug)`.
 *
 * **A module of its own, and that placement is load-bearing.** These are named by `RimeContext`,
 * which is what `event.locals.rime` is, which is what every hook's `HookContext` reaches. So
 * anything this file imports ends up in the type graph of every hook in the codebase.
 *
 * It therefore imports the two accessor types straight from each prototype's `api.server.ts`, and
 * nothing else. Reading them off each definition's `$InferAccessor` phantom instead would close
 * the loop — hook → HookContext → locals.rime → accessors → registry → definition → hook — and
 * TypeScript would answer `any` for every hook in the repo.
 *
 * The phantom is still worth having on the definition, since it documents what a kind
 * contributes; it is just not what this reads.
 */
export type PrototypeAccessors = {
  collection: CollectionAccessor;
  area: AreaAccessor;
};
