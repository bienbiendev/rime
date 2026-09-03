import type { PrototypeHandle, RegisterPrototypeArgs } from '$lib/core/adapter/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { RawDoc } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { baseTableName } from './naming.server.js';
import {
  childrenIds,
  deletePrototype,
  ensurePrototypeExists,
  existingIds,
  findManyPrototypes,
  insertPrototype,
  readPrototype,
  updatePrototype
} from './prototype.server.js';

/**
 * Which prototypes exist, and what each one can do.
 *
 * Prototypes register at boot. That is the whole reason this file exists: the adapter is handed
 * the prototypes it will serve *once*, rather than being asked to work one out from a slug on
 * every request. It also means a prototype whose tables are missing fails at boot, loudly, in a
 * place that names it — instead of on whichever request first happened to touch it.
 *
 * `adapter.prototype(slug)` then hands back that prototype's handle. The handle carries the
 * config and the singleton flag it was registered with, so nothing downstream re-derives them,
 * and — importantly — nothing downstream needs to know whether it is holding an area or a
 * collection. There is no such distinction here. See prototype.server.ts.
 */
export const createPrototypeRegistry = (deps: {
  db: any;
  tables: Dic;
  configCtx: ConfigContext;
}) => {
  const { db, tables, configCtx } = deps;
  const handles = new Map<string, PrototypeHandle>();

  const buildHandle = ({ config, singleton }: RegisterPrototypeArgs): PrototypeHandle => {
    const { slug } = config;

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

      find: (args = {}) =>
        readPrototype(
          { db, tables },
          {
            slug,
            // A singleton ignores an id it was never meant to be given.
            id: singleton ? undefined : args.id,
            versionId: args.versionId,
            select: args.select,
            locale: args.locale,
            draft: args.draft,
            config
          }
        ) as Promise<RawDoc | undefined>,

      findMany: (args = {}) =>
        findManyPrototypes({ db, tables, configCtx }, { ...args, slug, config }),

      insert: (args) => {
        if (singleton) refuseOnSingleton('insert');
        return insertPrototype({ db, tables }, { ...args, slug, config });
      },

      update: async (args) => {
        const id = singleton ? await resolveSingletonId() : args.id!;
        return updatePrototype(
          { db, tables },
          {
            slug,
            id,
            versionId: args.versionId,
            data: args.data,
            locale: args.locale,
            versionOperation: args.versionOperation,
            config
          }
        );
      },

      delete: (args) => {
        if (singleton) refuseOnSingleton('delete');
        return deletePrototype({ db, tables }, { slug, id: args.id });
      },

      ensureExists: (args) => ensurePrototypeExists({ db, tables }, { ...args, slug, config }),

      childrenIds: (args) => childrenIds({ db, tables }, { ...args, slug }),

      existingIds: (args) => existingIds({ db, tables }, { ...args, slug })
    };
  };

  return {
    register: (args: RegisterPrototypeArgs) => {
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

    get: (slug: string): PrototypeHandle => {
      const handle = handles.get(slug);

      if (!handle) {
        throw new RimeError(RimeError.INIT, `\`${slug}\` is not a registered prototype`);
      }

      return handle;
    }
  };
};
