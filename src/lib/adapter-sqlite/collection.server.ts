import type { CollectionHandle } from '#lib/core/adapter.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import type { RawDoc } from '#lib/core/prototype/types.js';
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
 * Many documents, addressed by id: `find`, `update` and `delete` take one, and `insert` makes a
 * new one. The area's builder is `area.server.ts` beside this.
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
