import type { TableHandle } from '$lib/core/adapter.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { GetRegisterType } from '$lib/index.js';
import type { Dic } from '$lib/util/types.js';
import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { declaredTableProperty } from './naming.server.js';
import type { GenericTable } from './types.server.js';

/**
 * Handles for the tables features declared — see `FeatureDefinition.tables`.
 *
 * The counterpart to `prototype.server.ts`, and much smaller for one reason: a declared table has
 * no config behind it. Nothing to resolve a path against, no locales branch, no children, no
 * blank to merge. So the filter is a flat column-to-value map and the verbs are three.
 *
 * This is what let `AuthAdapter` collapse to Better-auth's own adapter. Its last three methods
 * read and wrote `auth_users`, `auth_sessions` and `auth_accounts` — real tables that core simply
 * had no way to name until a feature could declare one.
 */
export const createTableRegistry = (args: {
  db: LibSQLDatabase<GetRegisterType<'Schema'>>;
  tables: GetRegisterType<'Tables'>;
}) => {
  const { db, tables } = args;

  const get = (slug: string): TableHandle => {
    const name = declaredTableProperty(slug);
    const table = tables[name as keyof typeof tables] as unknown as GenericTable;

    if (!table) {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        `no table declared for "${slug}" — the schema has no "${name}"`
      );
    }

    /** Every condition, ANDed. An unknown column is a caller error, not an empty filter. */
    const conditions = (where: Dic) =>
      Object.entries(where).map(([column, value]) => {
        if (!(column in table)) {
          throw new RimeError(RimeError.OPERATION_ERROR, `"${slug}" has no column "${column}"`);
        }
        return eq(table[column], value);
      });

    /**
     * The filter for a write. Empty is refused rather than treated as "everything": `and()` of
     * nothing is `undefined`, which drizzle renders as a statement with no `WHERE` clause.
     */
    const writeFilter = (where: Dic, verb: string) => {
      const built = conditions(where);
      if (!built.length) {
        throw new RimeError(
          RimeError.OPERATION_ERROR,
          `refusing to ${verb} every row of "${slug}"`
        );
      }
      return and(...built);
    };

    return {
      find: async ({ where = {}, select, limit } = {}) => {
        const columns = select?.length
          ? Object.fromEntries(select.map((column) => [column, table[column]]))
          : undefined;

        let query = (columns ? db.select(columns) : db.select()).from(table) as any;

        const built = conditions(where);
        if (built.length) query = query.where(and(...built));
        if (limit) query = query.limit(limit);

        return (await query) as Dic[];
      },

      update: async ({ where, data }) => {
        await db.update(table).set(data).where(writeFilter(where, 'update'));
      },

      delete: async ({ where }) => {
        await db.delete(table).where(writeFilter(where, 'delete'));
      }
    };
  };

  return get;
};
