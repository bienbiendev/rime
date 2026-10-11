import type { TableHandle } from '#lib/core/adapter.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { GetRegisterType } from '#lib/index.js';
import type { Dic } from '#lib/util/types.js';
import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import { declaredTableProperty } from './naming.server.js';
import type { GenericTable, SqliteDatabase } from './types.server.js';

/**
 * Handles for the tables a config declares in `$tables`, the ones no prototype owns: better-auth's
 * users, sessions and accounts (`core/auth/configure.ts`).
 *
 * The counterpart to the prototype handles (`collection.server.ts`, `area.server.ts`), and much
 * smaller for one reason: a declared table has no config behind it. Nothing to resolve a path against, no locales branch, no children, no
 * empty fields to add. So the filter is a flat column-to-value map and the verbs are three.
 */
export const createTableHandles = (args: {
  db: SqliteDatabase;
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

    /** The column named `name`. An unknown column is a caller error, not an empty filter. */
    const columnOf = (name: string) => {
      if (!Object.hasOwn(getTableColumns(table), name)) {
        throw new RimeError(RimeError.OPERATION_ERROR, `"${slug}" has no column "${name}"`);
      }
      return table[name];
    };

    /** Every condition, ANDed. A `null` value matches the rows holding none. */
    const conditions = (where: Dic) =>
      Object.entries(where).map(([name, value]) =>
        value === null ? isNull(columnOf(name)) : eq(columnOf(name), value)
      );

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
          ? Object.fromEntries(select.map((name) => [name, columnOf(name)]))
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
