import type { AdapterDeps } from '#lib/adapter-sqlite/types.server.js';
import type { Dic } from '#lib/util/types.js';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { omit } from '../util/object.js';
import { generatePK, ROW_ADDRESS, transformDataToSchema } from './columns.server.js';
import { tableName, type TableName } from './naming.server.js';

/*
 * The rows of a repeatable field: a block of a block list, an item of a tree. Each lives in a
 * table of its own kind, and a localized table keeps its localized values in a locales branch.
 */

/** Writes `row` over its stored row, and its localized values in `locale`. */
export const updateRepeatable = async (
  { db, tables }: AdapterDeps,
  table: TableName,
  row: Dic,
  locale?: string
) => {
  const columns = getTableColumns(tables[table]);
  const values = transformDataToSchema(omit(ROW_ADDRESS, row), columns);

  if (Object.keys(values).length) {
    await db.update(tables[table]).set(values).where(eq(tables[table].id, row.id));
  }

  const localesTable = tableName({ owner: table, branch: 'locales' });
  if (locale && localesTable in tables) {
    const tableLocales = tables[localesTable];
    const localizedColumns = getTableColumns(tableLocales);
    const localizedValues = transformDataToSchema(omit(ROW_ADDRESS, row), localizedColumns);

    if (!Object.keys(localizedValues).length) return true;

    // @ts-expect-error the locales table name is a key of db.query
    const localizedRow = await db.query[localesTable].findFirst({
      where: { ownerId: row.id, locale }
    });

    if (!localizedRow) {
      await db.insert(tableLocales).values({
        ...localizedValues,
        id: generatePK(),
        locale,
        ownerId: row.id
      });
    } else {
      await db
        .update(tableLocales)
        .set(localizedValues)
        .where(and(eq(tableLocales.ownerId, row.id), eq(tableLocales.locale, locale)));
    }
  }
  return true;
};

/** Deletes the stored row. */
export const deleteRepeatable = async (
  { db, tables }: AdapterDeps,
  table: TableName,
  id: string
) => {
  await db.delete(tables[table]).where(eq(tables[table].id, id));
  return true;
};

/** Inserts `row` for `ownerId`, and its localized values in `locale`. The row gets a new id. */
export const createRepeatable = async (
  { db, tables }: AdapterDeps,
  table: TableName,
  row: Dic,
  ownerId: string,
  locale?: string
) => {
  const id = generatePK();
  const localesTable = tableName({ owner: table, branch: 'locales' });

  if (locale && localesTable in tables) {
    const unlocalizedColumns = getTableColumns(tables[table]);
    const localizedColumns = getTableColumns(tables[localesTable]);

    await db.insert(tables[table]).values({
      ...transformDataToSchema(row, unlocalizedColumns),
      id,
      ownerId,
      locale
    });

    await db.insert(tables[localesTable]).values({
      ...transformDataToSchema(row, localizedColumns),
      id: generatePK(),
      ownerId: id,
      locale
    });
  } else {
    const columns = getTableColumns(tables[table]);
    await db.insert(tables[table]).values({
      ...transformDataToSchema(row, columns),
      ownerId,
      id,
      locale
    });
  }
  return true;
};
