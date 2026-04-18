import { logger } from '$lib/core/logger/index.server.js';
import { withLocalesSuffix, withVersionsSuffix } from '$lib/core/naming.js';
import type { PrototypeSlug } from '$lib/core/types/doc.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import { asc, desc, getTableColumns, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { pathToDatabaseColumn } from './util.js';

type Args = {
  slug: PrototypeSlug;
  locale?: string;
  config: BuiltArea | BuiltCollection;
  by?: string;
  tables: any;
};

export const buildOrderByParam = ({ slug, locale, tables, config, by }: Args) => {
  const hasVersions = !!config.versions;

  const getOrderFunc = (str?: string) => {
    if (typeof str !== 'string') return asc;
    return str.charAt(0) === '-' ? desc : asc;
  };

  // Get the root table
  const rootTable = tables[slug];
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

  // For non-versioned collections
  if (!hasVersions) {
    const rootTableColumns = Object.keys(getTableColumns(rootTable));

    // Check if the column exists in the root table
    if (rootTableColumns.includes(columnStr)) {
      return [orderFunc(rootTable[columnStr])];
    }

    // Check if it's a localized field in a non-versioned collection
    if (locale) {
      const localeTableName = withLocalesSuffix(slug) as keyof typeof tables;
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
    const versionTableName = withVersionsSuffix(slug);
    const versionsTable = tables[versionTableName];
    const versionsTableColumns = Object.keys(getTableColumns(versionsTable));

    // Check if the column exists in the versions table and is not a system field
    if (
      versionsTableColumns.includes(columnStr) &&
      columnStr !== 'createdAt' &&
      columnStr !== 'updatedAt'
    ) {
      const { name: sqlVersionsTableName } = getTableConfig(versionsTable);
      const { name: sqlRootTableName } = getTableConfig(rootTable);

      // Use a subquery to get the value from the latest version for ordering
      return [
        orderFunc(
          sql.raw(
            `(SELECT DISTINCT ${sqlVersionsTableName}."${columnStr}" FROM ${sqlVersionsTableName} WHERE ${sqlVersionsTableName}."owner_id" = ${sqlRootTableName}."id" ORDER BY ${sqlVersionsTableName}."updated_at" DESC LIMIT 1)`
          )
        )
      ];
    }

    // Check if it's a localized field in a versioned collection
    if (locale) {
      const versionsLocaleTableName = withLocalesSuffix(versionTableName) as keyof typeof tables;
      if (versionsLocaleTableName in tables) {
        const localeTable = tables[versionsLocaleTableName];
        const localizedColumns = getTableColumns(localeTable);

        if (Object.keys(localizedColumns).includes(columnStr)) {
          const { name: sqlLocaleTableName } = getTableConfig(localeTable);
          const { name: sqlVersionsTableName } = getTableConfig(versionsTable);
          const { name: sqlRootTableName } = getTableConfig(rootTable);

          // Nested subquery: first get the latest version, then get the localized value
          return [
            orderFunc(
              sql.raw(
                `(SELECT ${sqlLocaleTableName}."${localizedColumns[columnStr].name}"
								  FROM ${sqlLocaleTableName}
								  WHERE ${sqlLocaleTableName}."owner_id" IN
								    (SELECT ${sqlVersionsTableName}."id"
									 FROM ${sqlVersionsTableName}
									 WHERE ${sqlVersionsTableName}."owner_id" = ${sqlRootTableName}."id"
									 ORDER BY ${sqlVersionsTableName}."updated_at" DESC LIMIT 1)
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
