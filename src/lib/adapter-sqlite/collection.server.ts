import type { CollectionHandle } from '$lib/core/adapter.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import type { RawDoc } from '$lib/core/prototype/types.js';
import { bundles, type HandleDeps } from './rows.server.js';
import { findManyPrototypes, readPrototype } from './read.server.js';
import {
  deletePrototype,
  insertPrototype,
  updatePrototype,
  updateWherePrototype
} from './write.server.js';

/**
 * What the adapter can do to one registered collection.
 *
 * Many documents, addressed by id: every verb here takes one, and `insert` makes a new one. The
 * area's builder is `area.server.ts` beside this, and the two are separate files because they are
 * separate things — one handle with a `singleton` flag meant `id: singleton ? undefined : args.id`
 * on every read, `resolveSingletonId()` on every write, and two throws for verbs an area was never
 * offered.
 */
export const createCollectionHandle = (deps: HandleDeps): CollectionHandle => {
  const { write, read, self } = bundles(deps);
  const { slug } = self;

  return {
    slug,
    config: deps.config as BuiltCollection,
    versions: deps.versions,

    find: (args) => readPrototype(read, { ...args, ...self }) as Promise<RawDoc | undefined>,

    findMany: (args = {}) => findManyPrototypes(read, { ...args, ...self }),

    insert: (args) => insertPrototype(write, { ...args, slug, versions: deps.versions }),

    update: (args) => updatePrototype(write, { ...args, slug, versions: deps.versions }),

    updateWhere: (args) => updateWherePrototype(read, { ...args, slug }),

    delete: (args) => deletePrototype(write, { slug, id: args.id })
  };
};
