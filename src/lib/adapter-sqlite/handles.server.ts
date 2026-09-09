import type { PrototypeHandle, RegisterPrototypeArgs } from '$lib/core/adapter.js';
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
 * shadow and the singleton flag it was registered with, so nothing downstream re-derives them.
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
  const handles = new Map<string, PrototypeHandle>();

  const buildHandle = ({ config, singleton, shadow }: RegisterPrototypeArgs): PrototypeHandle => {
    const { slug } = config;

    // What every call below re-stated: the connection, and which prototype this handle is.
    const write = { db, tables };
    const read = { db, tables, configCtx };
    const self = { slug, config, shadow };

    /**
     * A singleton has no id to be given, so it looks its one row up. This is the *only* place
     * the difference shows in a write, and it is why an area needed no `id` parameter.
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

    /** What a singleton refuses, and why, in one place. */
    const refuseOnSingleton = (operation: string) => {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        `${operation} is not available on ${slug}: it holds exactly one document`
      );
    };

    return {
      slug,
      singleton,
      config,
      shadow,

      find: (args = {}) =>
        readPrototype(read, {
          ...args,
          ...self,
          // A singleton ignores an id it was never meant to be given.
          id: singleton ? undefined : args.id
        }) as Promise<RawDoc | undefined>,

      findMany: (args = {}) => findManyPrototypes(read, { ...args, ...self }),

      insert: (args) => {
        if (singleton) refuseOnSingleton('insert');
        return insertPrototype(write, { ...args, slug, shadow });
      },

      update: async (args) => {
        const id = singleton ? await resolveSingletonId() : args.id!;
        return updatePrototype(write, { ...args, slug, id, shadow });
      },

      updateWhere: (args) => updateWherePrototype(read, { ...args, slug }),

      delete: (args) => {
        if (singleton) refuseOnSingleton('delete');
        return deletePrototype(write, { slug, id: args.id });
      },

      ensureExists: (args) => ensurePrototypeExists(write, { ...args, slug, shadow })
    };
  };

  /**
   * Named for the two `Adapter` members they become, so the wiring in `index.server.ts` reads as
   * a spread rather than a rename. They were `register` and `get`, and nothing in `get` said it
   * was `adapter.prototype`.
   */
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

    prototype: (slug: string): PrototypeHandle => {
      const handle = handles.get(slug);

      if (!handle) {
        throw new RimeError(RimeError.INIT, `\`${slug}\` is not a registered prototype`);
      }

      return handle;
    }
  };
};
