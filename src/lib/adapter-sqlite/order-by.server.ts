import { logger } from '$lib/core/logger.server.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import { asc, desc, getTableColumns, sql } from 'drizzle-orm';
import { pathToDatabaseColumn } from './columns.server.js';
import { baseTableName, tableName, type TableName } from './naming.server.js';

type Args = {
  slug: PrototypeSlug;
  locale?: string;
  by?: string;
  tables: any;
  /**
   * The table this prototype's content lives in, when it is not the base row — resolved by the
   * caller from the versions table it was registered with.
   *
   * The question here is "are this prototype's sortable columns on the base row or somewhere
   * else", which is about tables — so it is answered with a table name, not a config member.
   */
  versions?: TableName;
  /**
   * The table the ordering is built against.
   *
   * A relational query renames the table it selects from — `from "pages" as "d0"` — so both a
   * plain column and the correlated subqueries below have to name what the caller was handed,
   * not the imported object. `update` and `delete` do not alias and pass nothing.
   */
  rootTable?: any;
};

export const buildOrderByParam = ({
  slug,
  locale,
  tables,
  by,
  versions,
  rootTable: aliasedRoot
}: Args) => {
  // Presence in the schema, not a config member: a declared versions with no table is not one.
  const hasShadow = !!versions && versions in tables;

  const getOrderFunc = (str?: string) => {
    if (typeof str !== 'string') return asc;
    return str.charAt(0) === '-' ? desc : asc;
  };

  // Get the root table — the caller's alias where there is one.
  const rootTable = aliasedRoot ?? tables[baseTableName(slug)];
  by = by ? pathToDatabaseColumn(by) : by;

  // Default case: no sort parameter provided
  if (!by) {
    // Default to sorting by updatedAt in descending order
    return [desc(rootTable.updatedAt)];
  }

  // Handle system fields (createdAt/updatedAt)
  if (by === 'createdAt' || by === 'updatedAt' || by === '-createdAt' || by === '-updatedAt') {
    // Determine sort direction (asc/desc) based on presence of '-' prefix
    const orderFunc = getOrderFunc(by);
    // Remove the '-' prefix if present to get the actual column name
    const columnStr = by.replace(/^-/, '');
    return [orderFunc(rootTable[columnStr])];
  }

  const orderFunc = getOrderFunc(by);
  const columnStr = by.replace(/^-/, '');

  /**
   * A column on the prototype's own table, whether or not it also has a versions table.
   *
   * Checked for a versioned prototype too, which is what lets `?sort=_position` work on one: the
   * hierarchy and path columns are `$root()` fields and live on the base row.
   *
   * Safe in both branches because the two tables' columns are disjoint by construction — the
   * schema generator sends `$root()` fields to one and everything else to the other — and the
   * system fields they share (`createdAt`, `updatedAt`) are answered above this.
   */
  const rootTableColumns = Object.keys(getTableColumns(rootTable));
  if (rootTableColumns.includes(columnStr)) {
    return [orderFunc(rootTable[columnStr])];
  }

  // No versions: every remaining sortable column is a localized one.
  if (!hasShadow) {
    // Check if it's a localized field in a non-versioned collection
    if (locale) {
      const localeTableName = tableName({
        owner: baseTableName(slug),
        branch: 'locales'
      }) as keyof typeof tables;
      if (localeTableName in tables) {
        const localeTable = tables[localeTableName];
        const localizedColumns = getTableColumns(localeTable);

        if (Object.keys(localizedColumns).includes(columnStr)) {
          // Interpolated, not `sql.raw`: the outer table may be an alias, so its id has to come
          // from the column object rather than from a name read off the schema. Parameterises
          // `locale` on the way past.
          return [
            orderFunc(
              sql`(SELECT DISTINCT ${localeTable[columnStr]} FROM ${localeTable} WHERE ${localeTable.ownerId} = ${rootTable.id} AND ${localeTable.locale} = ${locale})`
            )
          ];
        }
      }
    }
  } else {
    const versionsTableName = versions!;
    const versionsTable = tables[versionsTableName];
    const versionsTableColumns = Object.keys(getTableColumns(versionsTable));

    // Check if the column exists in the versions table and is not a system field
    if (
      versionsTableColumns.includes(columnStr) &&
      columnStr !== 'createdAt' &&
      columnStr !== 'updatedAt'
    ) {
      // The value from the newest content row.
      return [
        orderFunc(
          sql`(SELECT DISTINCT ${versionsTable[columnStr]} FROM ${versionsTable} WHERE ${versionsTable.ownerId} = ${rootTable.id} ORDER BY ${versionsTable.updatedAt} DESC LIMIT 1)`
        )
      ];
    }

    // Check if it's a localized field on the versions table
    if (locale) {
      const versionsLocaleTableName = tableName({
        owner: versionsTableName,
        branch: 'locales'
      }) as keyof typeof tables;
      if (versionsLocaleTableName in tables) {
        const localeTable = tables[versionsLocaleTableName];
        const localizedColumns = getTableColumns(localeTable);

        if (Object.keys(localizedColumns).includes(columnStr)) {
          // Two hops: the newest content row, then its localized value.
          return [
            orderFunc(
              sql`(SELECT ${localeTable[columnStr]}
                     FROM ${localeTable}
                    WHERE ${localeTable.ownerId} IN
                          (SELECT ${versionsTable.id}
                             FROM ${versionsTable}
                            WHERE ${versionsTable.ownerId} = ${rootTable.id}
                            ORDER BY ${versionsTable.updatedAt} DESC LIMIT 1)
                      AND ${localeTable.locale} = ${locale}
                    LIMIT 1)`
            )
          ];
        }
      }
    }
  }

  logger.warn(`"${by}" is not a property of ${slug}`);

  // Fallback to ordering by createdAt on the root table
  return [desc(rootTable.createdAt)];
};
