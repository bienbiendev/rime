import { logger } from '$lib/core/logger.server.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import { asc, desc, getTableColumns, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { pathToDatabaseColumn } from './columns.server.js';
import { baseTableName, tableName, type TableName } from './naming.server.js';

type Args = {
  slug: PrototypeSlug;
  locale?: string;
  by?: string;
  tables: any;
  /**
   * The table this prototype's content lives in, when it is not the base row — resolved by the
   * caller from the shadow it was registered with.
   *
   * This used to be read off a config member, with the shadow's name rebuilt here from a
   * feature's own suffix. Two things wrong with that: the adapter named a feature, and it asked a
   * config a question the schema already answers. The question the sort builder actually has is
   * "are this prototype's sortable columns on the base row or somewhere else", which is about
   * tables, so it is asked of `tables`.
   */
  shadow?: TableName;
};

export const buildOrderByParam = ({ slug, locale, tables, by, shadow }: Args) => {
  // Presence in the schema, not a config member: a declared shadow with no table is not one.
  const hasShadow = !!shadow && shadow in tables;

  const getOrderFunc = (str?: string) => {
    if (typeof str !== 'string') return asc;
    return str.charAt(0) === '-' ? desc : asc;
  };

  // Get the root table
  const rootTable = tables[baseTableName(slug)];
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
   * A column on the prototype's own table, whether or not it also has a shadow.
   *
   * This used to be inside the `!hasShadow` branch, and the shadow branch never looked at the base
   * table at all — so a shadowed prototype could not sort by any of its **base-row** columns. Those
   * are exactly the `._root()` ones — the hierarchy and path columns features put on a base row.
   * `?sort=_position` on a shadowed prototype warned "not a property" and silently ordered by
   * `createdAt` instead.
   *
   * Safe in both branches because the two tables' columns are disjoint by construction — the
   * schema generator sends `._root()` fields to one and everything else to the other — and the
   * system fields they share (`createdAt`, `updatedAt`) are answered above this.
   */
  const rootTableColumns = Object.keys(getTableColumns(rootTable));
  if (rootTableColumns.includes(columnStr)) {
    return [orderFunc(rootTable[columnStr])];
  }

  // No shadow: every remaining sortable column is a localized one.
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
          const { name: sqlLocaleTableName } = getTableConfig(localeTable);
          const { name: sqlTableName } = getTableConfig(rootTable);
          return [
            orderFunc(
              sql.raw(
                `(SELECT DISTINCT ${sqlLocaleTableName}."${localizedColumns[columnStr].name}" FROM ${sqlLocaleTableName} WHERE ${sqlLocaleTableName}."owner_id" = ${sqlTableName}."id" AND ${sqlLocaleTableName}."locale" = '${locale}')`
              )
            )
          ];
        }
      }
    }
  } else {
    const shadowTableName = shadow!;
    const shadowTable = tables[shadowTableName];
    const shadowTableColumns = Object.keys(getTableColumns(shadowTable));

    // Check if the column exists in the shadow table and is not a system field
    if (
      shadowTableColumns.includes(columnStr) &&
      columnStr !== 'createdAt' &&
      columnStr !== 'updatedAt'
    ) {
      const { name: sqlShadowTableName } = getTableConfig(shadowTable);
      const { name: sqlRootTableName } = getTableConfig(rootTable);

      // Use a subquery to get the value from the newest content row for ordering
      return [
        orderFunc(
          sql.raw(
            `(SELECT DISTINCT ${sqlShadowTableName}."${columnStr}" FROM ${sqlShadowTableName} WHERE ${sqlShadowTableName}."owner_id" = ${sqlRootTableName}."id" ORDER BY ${sqlShadowTableName}."updated_at" DESC LIMIT 1)`
          )
        )
      ];
    }

    // Check if it's a localized field on the shadow
    if (locale) {
      const shadowLocaleTableName = tableName({
        owner: shadowTableName,
        branch: 'locales'
      }) as keyof typeof tables;
      if (shadowLocaleTableName in tables) {
        const localeTable = tables[shadowLocaleTableName];
        const localizedColumns = getTableColumns(localeTable);

        if (Object.keys(localizedColumns).includes(columnStr)) {
          const { name: sqlLocaleTableName } = getTableConfig(localeTable);
          const { name: sqlShadowTableName } = getTableConfig(shadowTable);
          const { name: sqlRootTableName } = getTableConfig(rootTable);

          // Nested subquery: first get the newest content row, then get the localized value
          return [
            orderFunc(
              sql.raw(
                `(SELECT ${sqlLocaleTableName}."${localizedColumns[columnStr].name}"
								  FROM ${sqlLocaleTableName}
								  WHERE ${sqlLocaleTableName}."owner_id" IN
								    (SELECT ${sqlShadowTableName}."id"
									 FROM ${sqlShadowTableName}
									 WHERE ${sqlShadowTableName}."owner_id" = ${sqlRootTableName}."id"
									 ORDER BY ${sqlShadowTableName}."updated_at" DESC LIMIT 1)
								  AND ${sqlLocaleTableName}."locale" = '${locale}'
								  LIMIT 1)`
              )
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
