import { RimeError } from '#lib/core/errors/index.js';
import type { RawDoc } from '#lib/core/prototype/types.js';
import { omit, pick } from '#lib/util/object.js';
import { randomId } from '#lib/util/random.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { baseFieldNames } from '#lib/core/fields/util.js';
import type { Dic } from '#lib/util/types.js';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { isPathsTable, JOIN_SUFFIX } from './naming.server.js';

/**
 * A new primary key: a random UUID.
 */
export const generatePK = (): string => {
  return crypto.randomUUID();
};

/**
 * The columns that say where a row sits rather than what it holds: its own id, the row it hangs
 * off, and the locale a branch row is for. The adapter sets them; a document's data never does.
 */
export const ROW_ADDRESS = ['id', 'ownerId', 'locale'];

/**
 * Updates one row by id with `data`. Does nothing when `data` is empty.
 */
export async function updateTableRecord(
  db: any,
  tables: any,
  tableName: string,
  options: {
    recordId: string;
    data: any;
  }
) {
  const { recordId, data } = options;
  if (Object.keys(data).length) {
    await db.update(tables[tableName]).set(data).where(eq(tables[tableName].id, recordId));
  }
}

/**
 * Inserts a new record into a database table
 * @returns The ID of the inserted record
 */
export async function insertTableRecord(
  db: any,
  tables: any,
  tableName: string,
  data: any
): Promise<string> {
  const recordId = data.id || generatePK();
  await db.insert(tables[tableName]).values({
    ...data,
    id: recordId
  });
  return recordId;
}

/**
 * Updates or inserts localized data for a record. The row is the one `ownerId` and `locale` name;
 * the `ROW_ADDRESS` keys of `data` are dropped.
 */
export async function upsertLocalizedData(
  db: any,
  tables: any,
  tableLocalesName: string,
  options: {
    ownerId: string;
    data: any;
    locale: string;
  }
) {
  const { ownerId, locale } = options;
  const data = omit(ROW_ADDRESS, options.data);
  if (Object.keys(data).length) {
    const tableLocales = tables[tableLocalesName];
    const localizedRow = await db.query[tableLocalesName].findFirst({
      where: { ownerId, locale }
    });

    if (localizedRow) {
      // Update existing localized data
      await db
        .update(tableLocales)
        .set(data)
        .where(and(eq(tableLocales.ownerId, ownerId), eq(tableLocales.locale, locale)));
    } else {
      // Insert new localized data
      await db.insert(tableLocales).values({
        ...data,
        id: generatePK(),
        ownerId,
        locale
      });
    }
  }
}

/**
 * Prepares data for database operations by transforming it according to table schemas
 */
export function prepareSchemaData(
  data: any,
  options: {
    mainTableName: string;
    localesTableName: string;
    locale?: string;
    tables: any;
    fillNotNull?: boolean;
  }
) {
  const { mainTableName, localesTableName, locale, tables, fillNotNull } = options;

  if (locale && localesTableName in tables) {
    // Handle localized fields
    const unlocalizedColumns = getTableColumns(tables[mainTableName]);
    const localizedColumns = getTableColumns(tables[localesTableName]);

    return {
      mainData: transformDataToSchema(data, unlocalizedColumns, { fillNotNull }),
      localizedData: transformDataToSchema(data, localizedColumns, { fillNotNull }),
      isLocalized: true
    };
  } else {
    // Handle non-localized fields
    const columns = getTableColumns(tables[mainTableName]);
    return {
      mainData: transformDataToSchema(data, columns, { fillNotNull }),
      localizedData: {},
      isLocalized: false
    };
  }
}

/**
 * Folds a base row and its content row into one document.
 *
 * A prototype whose content lives on a versions table reads as two rows; a document is one. This
 * is the fold, and only the adapter knows there were two. The content row's id goes out as
 * `contentId`; whichever feature declared the versions names it on the document, in a hook.
 *
 * Which row answers what:
 *
 * ```
 * id, createdAt, $root() fields   the base row — the document
 * updatedAt, everything else      the content row — the version being read
 * ```
 *
 * The base row's own `updatedAt` is not merged. It moves on every write to any version and is
 * what the default list sort orders by; the document reports when the version it shows was
 * written.
 */
export function mergeContentRow(
  doc: RawDoc,
  contentTable: string,
  config: { fields: FieldBuilder[] },
  select?: string[]
): RawDoc {
  // A base row with no content row is as good as absent — note this can be empty when a query
  // returns no result.
  if (!doc[contentTable] || doc[contentTable].length === 0) {
    throw new RimeError(RimeError.NOT_FOUND);
  }

  const contentRow = doc[contentTable][0];

  if (select && Array.isArray(select) && select.length) {
    // The row's own columns, plus whatever the config keeps on the base row.
    const rootProps = ['createdAt', 'id', ...baseFieldNames(config)];
    const hasRootSelectColumn = rootProps.some((column) => select.includes(column));
    // A resolved reference's target, joined only when its column was selected.
    const joined = Object.keys(doc).filter((key) => key.endsWith(JOIN_SUFFIX) || isPathsTable(key));

    // Pick the selected base columns on doc, or only the "id"
    const docFields = hasRootSelectColumn
      ? pick([...select.filter((field) => rootProps.includes(field as any)), 'id', ...joined], doc)
      : pick(['id', ...joined], doc);

    // Filter out root props as they should come from the doc,
    // plus the ownerId wich is equals to doc.id
    const contentFields = omit([...rootProps, 'ownerId'], contentRow);

    // `pick`/`omit` return generic Dic types, so TS can't statically confirm
    // `id` survived — it always does, since we explicitly pick it above.
    return {
      ...docFields,
      ...contentFields,
      contentId: contentRow.id
    } as unknown as RawDoc;
  }

  // Default case - return all fields
  // `contentTable` is a plain `string`, not a literal, so `Omit<T, string>`
  // widens to `Omit<T, keyof T>` and TS loses track of every spread key
  // (including `id`) — the object is correct at runtime, only its inferred
  // type collapses, hence the double cast through `unknown`.
  return {
    ...omit([contentTable], doc),
    ...omit(['id', 'ownerId', 'createdAt'], contentRow),
    contentId: contentRow.id
  } as unknown as RawDoc;
}

export function columnsParams({ table, select }: { table: Dic; select?: string[] }) {
  // Create an object to hold the columns we want to select
  const selectColumns: Dic = {};
  // If select fields are specified, build the select columns object
  if (select && select.length > 0) {
    // Always include the ID column for the version
    selectColumns.id = true;
    // Process each requested field
    for (const path of select) {
      const sqlPath = pathToDatabaseColumn(path);
      // If this column exists on the content table, add it to our select
      if (sqlPath in table) {
        selectColumns[sqlPath] = true;
      }
    }
  }
  return Object.keys(selectColumns).length ? selectColumns : undefined;
}

/**
 * Convert a document path using dot notation to a database schema path using double underscores.
 * This transformation is needed because SQL databases don't support dots in column names.
 *
 * @param path - The document path with dot notation
 * @returns The database column path with double underscore notation
 *
 * @example
 * // Returns 'attributes__hero__title'
 * pathToDatabaseColumn('attributes.hero.title');
 */
export const pathToDatabaseColumn = (path: string): string => path.replace(/\./g, '__');

/**
 * Convert a database schema path using double underscores to a document path using dot notation.
 * This transforms database column names back to document property paths.
 *
 * @param path - The database column path with double underscore notation
 * @returns The document path with dot notation
 *
 * @example
 * // Returns 'attributes.hero.title'
 * databaseColumnToPath('attributes__hero__title');
 */
export const databaseColumnToPath = (path: string): string =>
  isStructuralKey(path) ? path : path.replace(/__/g, '.');

/**
 * Is this key a table name rather than a column path?
 *
 * Both use `__` as a separator, so converting it to `.` blindly turns a table key into nested
 * document properties: `settings__versions__$relations` becomes `settings.versions.$relations`,
 * which no longer matches the table key transform.server.ts drops, and it surfaces in the response
 * as wrong data.
 *
 * `$` is what separates the two. The naming convention uses it to mark structure — `__$` a
 * child, `__$$` a branch — and a column path can never contain one, since column names come
 * from field names, which are identifiers.
 */
const isStructuralKey = (key: string) => key.includes('$');

/**
 * Converts an object's keys from database schema format (double underscores) to document format (dot notation).
 *
 * This function takes an object with keys using database column naming (e.g., 'attributes__title')
 * and transforms them to document path format (e.g., 'attributes.title') while preserving the values.
 *
 * @param obj - The object with database column keys
 * @returns A new object with keys converted to document paths
 *
 * @example
 * // Returns { 'attributes.title': 'Home' }
 * transformDatabaseColumnsToPaths({ 'attributes__title': 'Home' });
 */
export const transformDatabaseColumnsToPaths = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[databaseColumnToPath(key)] = value;
  }
  return result;
};

/**
 * Extracts values from a data object and maps them to database column names using schema paths.
 *
 * This function converts document data (which may use nested objects with dot notation paths)
 * into a flat object with keys that match the database schema (using double underscore notation).
 * It only includes fields that exist in the provided columns schema.
 *
 * @param data - The document data object (may be nested)
 * @param columns - The database schema columns definition
 * @param params - Optional parameters for transformation
 * @param params.fillNotNull - If true, adds default values for NOT NULL columns
 * @returns A flat object with database column names and values
 *
 * @example
 * // Returns { 'attributes__title': 'Home' }
 * transformDataToSchema(
 *   { attributes: { title: 'Home' } },
 *   { 'attributes__title': { dataType: 'string', notNull: true } }
 * );
 *
 * // With fillNotNull, provides defaults for missing NOT NULL columns
 * transformDataToSchema(
 *   { attributes: {} },
 *   { 'attributes__title': { dataType: 'string', notNull: true } },
 *   { fillNotNull: true }
 * ); // Returns { 'attributes__title': '' }
 */
export const transformDataToSchema = (
  data: Record<string, any>,
  columns: Record<string, any>,
  params: { fillNotNull?: boolean } = { fillNotNull: false }
): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const column of Object.keys(columns)) {
    const columnConfig = columns[column];
    // Convert schema path (with __) to doc path (with .)
    const docPath = databaseColumnToPath(column);

    // Get value from nested path
    const pathParts = docPath.split('.');
    let value = data;
    for (const part of pathParts) {
      // A null group is null all the way down
      if (value === null || value === undefined) break;
      value = value[part];
    }

    // Case 1: Value exists and is not null - always use it
    if (value !== undefined && value !== null) {
      result[column] = value;
      continue;
    }

    // Case 2: Value is null - use it unless we need to fill it
    if (value === null && !params.fillNotNull) {
      result[column] = null;
      continue;
    }

    // Case 3: Add placeholders for missing or null values in not-null columns
    if (params.fillNotNull && columnConfig.notNull) {
      if (column === 'id') {
        result[column] = randomId(32);
        continue;
      }
      // A column with a default of its own takes it: the insert leaves it out
      if (columnConfig.hasDefault) continue;

      console.warn(`No default value provided for ${column}, setting it with a placeholder`);
      const empty = placeholder(columnConfig.dataType);
      if (empty !== undefined) {
        result[column] = empty;
      }
    }
  }

  return result;
};

/** A placeholder of a column's type, by drizzle's `dataType`: `'number double'`, `'object date'`… */
const placeholder = (dataType: string) => {
  if (dataType.startsWith('string')) return '';
  if (dataType.startsWith('number')) return 0;
  if (dataType === 'boolean') return false;
  if (dataType === 'object date') return new Date();
  if (dataType === 'object json') return {};
  return undefined;
};
