import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { RawDoc } from '$lib/core/types/doc.js';
import type { OperationQuery, ParsedOperationQuery } from '$lib/core/types/index.js';
import { isObjectLiteral, omit, pick } from '$lib/util/object.js';
import { randomId } from '$lib/util/random.js';
import type { Dic } from '$lib/util/types.js';
import { and, desc, eq, getTableColumns, Table } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import qs from 'qs';

/**
 * Main function to generated primaryKeys
 */
export const generatePK = (): string => {
  return crypto.randomUUID();
};

/**
 * Updates a database table with the provided data and timestamp
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
 * Updates or inserts localized data for a record
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
  const { ownerId, data, locale } = options;
  if (Object.keys(data).length) {
    const tableLocales = tables[tableLocalesName];
    const localizedRow = await db.query[tableLocalesName].findFirst({
      where: and(eq(tableLocales.ownerId, ownerId), eq(tableLocales.locale, locale))
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
        id: generatePK(),
        ...data,
        ownerId,
        locale
      });
    }
  }
}

/**
 * Extract root table properties :
 * - hierarchy props (nested) : _parent and _position
 * - directory props (upload) : _path
 * return an object with the data filtered and the rootData.
 */
export function extractRootData(data: any) {
  const rootData: { _parent?: string; _position?: number; _path?: string } = {};
  // extract nested collection props
  if ('_parent' in data) {
    rootData._parent = data._parent;
    delete data._parent;
  }
  if ('_position' in data) {
    rootData._position = data._position;
    delete data._position;
  }
  // extract upload directory props
  if ('_path' in data) {
    rootData._path = data._path;
    delete data._path;
  }
  return { data, rootData };
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
 * Merges a document with its version data to create a complete document representation
 *
 * In versioned collections/areas, data is split between:
 * - Root document table (containing hierarchy fields like _parent, _position, and metadata like createdAt)
 * - Version table (containing the actual content fields)
 *
 * This function combines these two data sources into a single document object:
 * 1. Validates that version data exists or throw 404
 * 2. Handles field selection if specified
 * 3. Preserves root document fields (id, createdAt, updatedAt, _parent, _position)
 * 4. Adds version fields while avoiding duplicates
 * 5. Includes the versionId in the result
 */
export function mergeRawDocumentWithVersion(
  doc: RawDoc,
  versionTableName: string,
  select?: string[]
) {
  // Check if we have version data
  // Note: Versions data can be empty when a query returns no result
  if (!doc[versionTableName] || doc[versionTableName].length === 0) {
    throw new RimeError(RimeError.NOT_FOUND);
  }

  const versionData = doc[versionTableName][0];

  if (select && Array.isArray(select) && select.length) {
    const rootProps = ['createdAt', 'updatedAt', '_parent', '_position', 'id'] as const;
    const hasRootSelectColumn = rootProps.some((column) => select.includes(column));

    // Pick "createdAt" and "updatedAt" on doc if they are in select, or only the "id"
    const docFields = hasRootSelectColumn
      ? pick([...select.filter((field) => rootProps.includes(field as any)), 'id'], doc)
      : pick(['id'], doc);

    // Filter out root props as they should come from the doc,
    // plus the ownerId wich is equals to doc.id
    const versionFields = omit([...rootProps, 'ownerId'], versionData);

    return {
      ...docFields,
      ...versionFields,
      versionId: versionData.id
    };
  }

  // Default case - return all fields
  return {
    ...omit([versionTableName], doc),
    ...omit(['id', 'ownerId', 'createdAt', 'updatedAt'], versionData),
    versionId: versionData.id
  };
}

/**
 * Build the query params to get either the latest updated document
 * or the published one if version.draft is enabled and draft is true
 */
export function buildPublishedOrLatestVersionParams(args: {
  draft?: boolean;
  config: BuiltArea | BuiltCollection;
  table: any;
}) {
  const { config, table, draft } = args;
  const hasStatus = config.versions && config.versions.draft;
  return hasStatus && !draft
    ? {
        where: eq(table.status, 'published'),
        limit: 1
      }
    : {
        orderBy: [desc(table.updatedAt)],
        limit: 1
      };
}

/**
 * Convert and validate on incoming query to a complient query
 * for the buildWhereParam wich require an object with a root prop where.
 *
 * @example
 * // returns
 * { where: queryObject }
 */
export function normalizeQuery(incomingQuery: OperationQuery): ParsedOperationQuery {
  let query;
  if (typeof incomingQuery === 'string') {
    try {
      query = qs.parse(incomingQuery);
    } catch (err: any) {
      throw new RimeError(
        RimeError.INVALID_DATA,
        'Unable to parse given string query ' + err.message
      );
    }
  } else {
    if (!isObjectLiteral(incomingQuery)) {
      throw new RimeError(RimeError.INVALID_DATA, 'Query is not an object');
    }
    query = incomingQuery;
  }
  if (!query.where) {
    throw new RimeError(RimeError.INVALID_DATA, 'Query must have a root where property');
  }
  return query as ParsedOperationQuery;
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
      // Convert nested paths (dot notation) to SQL format (double underscore)
      // Example: 'attributes.slug' becomes 'attributes__slug'
      const sqlPath = path.replace(/\./g, '__');
      // If this column exists on the versions table, add it to our select
      if (sqlPath in table) {
        selectColumns[sqlPath] = true;
      }
    }
  }
  return Object.keys(selectColumns).length ? selectColumns : undefined;
}

/**
 * Get the primary key name given a table
 */
export function getPrimaryKey(table: Table) {
  const columnsPrimary = getTableConfig(table).columns.filter((c) => c.primary);
  return columnsPrimary.length ? columnsPrimary[0].name : 'id';
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
export const databaseColumnToPath = (path: string): string => path.replace(/__/g, '.');

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
      value = value?.[part];
      if (value === undefined) break;
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

      console.warn(`No default value provided for ${column}, setting it with a placeholder`);
      // Add default values for not-null columns without defaults
      switch (columnConfig.dataType) {
        case 'string':
          result[column] = '';
          break;
        case 'number':
          result[column] = 0;
          break;
        case 'boolean':
          result[column] = false;
          break;
        case 'json':
          result[column] = {};
          break;
        case 'date':
          result[column] = new Date();
          break;
      }
    }
  }

  return result;
};
