import type { AreaHandle, CollectionHandle, RegisterPrototypeArgs } from '$lib/core/adapter.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { RawDoc } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { baseTableName } from './naming.server.js';
import { findManyPrototypes, readPrototype } from './read.server.js';
import {
  deletePrototype,
  ensurePrototypeExists,
  insertPrototype,
  updatePrototype,
  updateWherePrototype
} from './write.server.js';

/**
 * Which prototypes exist, and what each one can do.
 *
 * Prototypes register at boot. That is the whole reason this file exists: the adapter is handed
 * the prototypes it will serve *once*, rather than being asked to work one out from a slug on
 * every request. It also means a prototype whose tables are missing fails at boot, loudly, in a
 * place that names it — instead of on whichever request first happened to touch it.
 *
 * `adapter.prototype(slug)` then hands back that prototype's handle, carrying the config, the
 * versions and the singleton flag it was registered with, so nothing downstream re-derives them.
 *
 * **Nothing here knows the word "area".** The handle does carry `config`, and `config.type` would
 * say — the adapter simply has no use for it. What it needs is how many rows there are, which is
 * `singleton`, a fact about the data rather than about a kind. Reading `type === 'area'` would be
 * re-deriving that flag from a name it was already told the answer for.
 *
 * The verbs are one uniform set for both kinds, and that is what the 26 call sites need: most of
 * them hold a slug rather than a kind (`populateURL`, `resolveContentOwner`, upload's disk
 * cleanup, a relation's `relationTo`). The two a singleton cannot honour are refused here, at the
 * database boundary, because that is where the guarantee has to hold.
 */
export const createPrototypeHandles = (deps: {
  db: any;
  tables: Dic;
  configCtx: ConfigContext;
}) => {
  const { db, tables, configCtx } = deps;
  const handles = new Map<string, AreaHandle | CollectionHandle>();

  const buildHandle = ({ config, singleton, versions }: RegisterPrototypeArgs) => {
    const { slug } = config;

    // What every call below re-stated: the connection, and which prototype this handle is.
    const write = { db, tables };
    const read = { db, tables, configCtx };
    const self = { slug, config, versions };

    /**
     * A singleton has no id to be given, so it looks its one row up. The **only** place the
     * difference shows, now that the two kinds have separate handles: an area's verbs take no id,
     * so this is where the one it needs comes from.
     */
    const resolveSingletonId = async () => {
      const table = tables[baseTableName(slug)];
      const [row] = await db.select({ id: table.id }).from(table);

      if (!row) {
        throw new RimeError(
          RimeError.OPERATION_ERROR,
          `${slug} has no row; its boot step should have written one`
        );
      }

      return row.id as string;
    };

    const shared = {
      slug,
      config,
      versions,

      findMany: (args = {}) => findManyPrototypes(read, { ...args, ...self }),

      updateWhere: (args: Parameters<CollectionHandle['updateWhere']>[0]) =>
        updateWherePrototype(read, { ...args, slug })
    };

    const collectionHandle: CollectionHandle = {
      ...shared,

      find: (args) => readPrototype(read, { ...args, ...self }) as Promise<RawDoc | undefined>,

      insert: (args) => insertPrototype(write, { ...args, slug, versions }),

      update: (args) => updatePrototype(write, { ...args, slug, versions }),

      delete: (args) => deletePrototype(write, { slug, id: args.id })
    };

    const areaHandle: AreaHandle = {
      ...shared,

      // No id in, and no id out to the caller: the row is looked up here.
      find: (args = {}) =>
        readPrototype(read, { ...args, ...self, id: undefined }) as Promise<RawDoc | undefined>,

      update: async (args) =>
        updatePrototype(write, { ...args, slug, versions, id: await resolveSingletonId() }),

      ensureExists: (args) => ensurePrototypeExists(write, { ...args, slug, versions })
    };

    return singleton ? areaHandle : collectionHandle;
  };

  /**
   * Named for the two `Adapter` members they become, so the wiring in `index.server.ts` reads as
   * a spread rather than a rename. They were `register` and `get`, and nothing in `get` said it
   * was `adapter.prototype`.
   */
  const lookup = (slug: string) => {
    const handle = handles.get(slug);
    if (!handle) throw new RimeError(RimeError.INIT, `\`${slug}\` is not a registered prototype`);
    return handle;
  };

  return {
    registerPrototype: (args: RegisterPrototypeArgs) => {
      const table = baseTableName(args.config.slug);

      // The point of registering rather than resolving per request: a missing table is a
      // configuration or migration problem, and it should say so here.
      if (!tables[table]) {
        throw new RimeError(
          RimeError.INIT,
          `no table \`${table}\` for prototype \`${args.config.slug}\` — is the database migrated?`
        );
      }

      handles.set(args.config.slug, buildHandle(args));
    },

    /**
     * The two typed lookups. A caller that holds a `BuiltCollection` asks for a collection and a
     * caller that holds a `BuiltArea` asks for an area; the cast is the erasure registration
     * already makes, and sound for the same reason — a slug is registered under exactly one kind,
     * and `singleton` is what picked the handle above.
     */
    collection: (slug: string): CollectionHandle => lookup(slug) as CollectionHandle,

    area: (slug: string): AreaHandle => lookup(slug) as AreaHandle
  };
};
