import type { AreaHandle, CollectionHandle, RegisterPrototypeArgs } from '$lib/core/adapter.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { createAreaHandle } from './area.server.js';
import { createCollectionHandle } from './collection.server.js';
import { baseTableName } from './naming.server.js';

/**
 * Which prototypes exist, and which handle each one got.
 *
 * Prototypes register at boot. That is the whole reason this file exists: the adapter is handed
 * the prototypes it will serve *once*, rather than working one out from a slug on every request.
 * It also means a prototype whose tables are missing fails at boot, loudly, in a place that names
 * it — instead of on whichever request first happened to touch it.
 *
 * **The kind decides the handle, and `config.type` is the kind.** It used to be a `singleton`
 * boolean, because the adapter was not allowed the word "area" — so the difference lived on inside
 * every verb instead. It is allowed the word now, the same as `locale` and `auth`, and the
 * difference lives in two files: `collection.server.ts` and `area.server.ts`.
 */
export const createPrototypeRegistry = (deps: {
  db: any;
  tables: Dic;
  configCtx: ConfigContext;
}) => {
  const { db, tables, configCtx } = deps;
  const handles = new Map<string, AreaHandle | CollectionHandle>();

  const lookup = (slug: string) => {
    const handle = handles.get(slug);
    if (!handle) throw new RimeError(RimeError.INIT, `\`${slug}\` is not a registered prototype`);
    return handle;
  };

  return {
    registerPrototype: ({ config, versions }: RegisterPrototypeArgs) => {
      const table = baseTableName(config.slug);

      // The point of registering rather than resolving per request: a missing table is a
      // configuration or migration problem, and it should say so here.
      if (!tables[table]) {
        throw new RimeError(
          RimeError.INIT,
          `no table \`${table}\` for prototype \`${config.slug}\` — is the database migrated?`
        );
      }

      const args = { db, tables, configCtx, config, versions };

      handles.set(
        config.slug,
        config.type === 'area' ? createAreaHandle(args) : createCollectionHandle(args)
      );
    },

    /**
     * The two typed lookups.
     *
     * The cast is the erasure registration already makes, and sound for the same reason: a slug is
     * registered under exactly one kind, and `config.type` is what picked the handle above. A
     * caller holding a `BuiltCollection` asks for a collection; one holding a `BuiltArea` asks for
     * an area.
     */
    collection: (slug: string): CollectionHandle => lookup(slug) as CollectionHandle,

    area: (slug: string): AreaHandle => lookup(slug) as AreaHandle
  };
};
