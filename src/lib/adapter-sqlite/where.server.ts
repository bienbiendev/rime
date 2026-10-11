import { pathToDatabaseColumn } from './columns.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import { getFieldAtPath } from '#lib/core/fields/util.js';
import { logger } from '#lib/core/logger.server.js';
import type { ConfigContext } from '#lib/core/rime.server.js';
import { isRelationField } from '#lib/fields/relation/index.js';
import { type GetRegisterType } from '#lib/index.js';
import { isObjectLiteral } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import * as drizzleORM from 'drizzle-orm';
import { and, eq, getTableColumns, inArray, or, type SQL } from 'drizzle-orm';
import type { ParsedQs } from 'qs';
import type { PrototypeSlug } from '../types.js';
import { localeOrder } from './locales.server.js';
import { baseTableName, junctionKey, tableName } from './naming.server.js';
import type { GenericTable, SqliteDatabase } from './types.server.js';

type BuildWhereArgs = {
  query: ParsedQs;
  slug: PrototypeSlug;
  locale?: string;
  db: SqliteDatabase;
  tables: GetRegisterType<'Tables'>;
  configCtx: ConfigContext;
  /**
   * The prototype `slug` is the versions table of, when it is one.
   *
   * Two conditions are resolved differently against a versions table: `id` means the base row rather than
   * the content row, and the hierarchy columns (`_parent`, `_position`, `_path`) live on the base
   * table and have to be reached through it.
   *
   * Named by the caller, which read it off registration to pick this slug in the first place —
   * never inferred here from how a slug happens to be spelled.
   */
  base?: PrototypeSlug;
  /**
   * The table the outer condition is built against.
   *
   * A relational query renames the table it selects from — `from "pages" as "d0"` — so a
   * condition naming `pages` matches nothing. Those callers pass what the `RAW` callback handed
   * them; `update` and `delete` do not alias and pass nothing.
   *
   * Only the outer reference. Every subquery below reaches other tables, which are not aliased,
   * and keeps using the real objects out of `tables`.
   */
  rootTable?: GenericTable;
};

export const buildWhereParam = ({
  query,
  slug,
  db,
  locale,
  tables,
  configCtx,
  base,
  rootTable
}: BuildWhereArgs) => {
  /** `slug` names a content table standing in for `base`, not a prototype's own rows. */
  const isShadow = !!base;
  /** The generated table named `key`. */
  const getTable = (key: string) => tables[key as keyof typeof tables] as unknown as GenericTable;

  function getTablesAndColumns(slug: string) {
    // Get main table and localized table if applicable
    const table = getTable(baseTableName(slug));
    const tableNameLocales = tableName({ owner: baseTableName(slug), branch: 'locales' });
    const tableLocales = getTable(tableNameLocales);

    // Get localized and unlocalized columns
    const localizedColumns =
      locale && tableNameLocales in tables ? Object.keys(getTableColumns(tableLocales)) : [];
    const unlocalizedColumns = Object.keys(getTableColumns(table));

    return { table, tableLocales, localizedColumns, unlocalizedColumns };
  }

  const {
    // Get main table and localized table if applicable
    table: ownTable,
    tableLocales,
    localizedColumns,
    unlocalizedColumns
  } = getTablesAndColumns(slug);

  /** What the outer condition names — the caller's alias where there is one. */
  const table = (rootTable as typeof ownTable) ?? ownTable;

  // The base row a versions table hangs off, and its columns. `baseTableName`, not the bare
  // slug: a camelCase slug is not a table name.
  const baseTable = isShadow ? getTable(baseTableName(base!)) : undefined;
  const baseColumns = baseTable ? Object.keys(getTableColumns(baseTable)) : [];

  const buildCondition = (conditionObject: Dic): any | false => {
    // `{ a: …, b: … }` is `a` and `b`; `{ price: { greater_than: 1, less_than: 10 } }` is both bounds.
    const entries = Object.entries(conditionObject);
    if (entries.length > 1) {
      return and(
        ...entries.map(([key, value]) => buildCondition({ [key]: value })).filter(Boolean)
      );
    }
    const [[key, operators]] = entries;
    if (isObjectLiteral(operators) && Object.keys(operators).length > 1) {
      return and(
        ...Object.entries(operators)
          .map(([operator, value]) => buildCondition({ [key]: { [operator]: value } }))
          .filter(Boolean)
      );
    }

    // Handle nested AND conditions
    if ('and' in conditionObject && Array.isArray(conditionObject.and)) {
      const subConditions = conditionObject.and
        .map((condition) => buildCondition(condition as Dic))
        .filter(Boolean);
      return subConditions.length ? and(...subConditions) : false;
    }

    // Handle nested OR conditions
    if ('or' in conditionObject && Array.isArray(conditionObject.or)) {
      const subConditions = conditionObject.or
        .map((condition) => buildCondition(condition as Dic))
        .filter(Boolean);
      return subConditions.length ? or(...subConditions) : false;
    }

    conditionObject = normalizedForShadow(conditionObject, isShadow);

    const {
      // Get condition members
      column,
      sqlColumn,
      fn,
      operator,
      rawValue,
      value
    } = getConditionMembers(conditionObject);

    /**
     * `fn` on `column`, the value cast for `cast` (the column itself, unless it is an expression).
     * A `like` pattern is text whatever the column, and is never cast.
     */
    const compare = (column: any, cast: { dataType: string } = column) =>
      fn(column, LIKE_OPERATORS.includes(operator) ? value : castTo(cast, value));

    // A collection with `$url` finds its pages by url or by path through its paths table, in the
    // locale read. A versions table is matched through its `ownerId`, like any base-row filter.
    const pathsTable = getTable(
      tableName({ owner: baseTableName(base ?? slug), child: { kind: 'paths' } })
    );
    if (pathsTable && (column === 'url' || column === '_urlPath')) {
      const owners = db
        .select({ id: pathsTable.ownerId })
        .from(pathsTable)
        .where(
          and(
            eq(pathsTable.locale, locale ?? ''),
            compare(column === 'url' ? pathsTable.url : pathsTable.path)
          )
        );
      return inArray(isShadow ? table.ownerId : table.id, owners);
    }

    // Handle regular fields
    if (unlocalizedColumns.includes(sqlColumn)) {
      return compare(table[sqlColumn]);
    }

    // A localized column is compared as a read would show it: the first locale in the fallback
    // order that holds a value, `''` counting as none — so a page found by its slug in one locale
    // is found by the same slug in a locale it was not translated to yet.
    if (locale && localizedColumns.includes(sqlColumn)) {
      const { sql } = drizzleORM;
      const order = localeOrder(configCtx, locale) ?? [locale];
      const valueIn = (code: string) =>
        sql`NULLIF((SELECT ${tableLocales[sqlColumn]} FROM ${tableLocales} WHERE ${tableLocales.ownerId} = ${table.id} AND ${tableLocales.locale} = ${code}), '')`;
      const resolved =
        order.length > 1
          ? sql`COALESCE(${sql.join(order.map(valueIn), sql`, `)})`
          : valueIn(order[0]);

      if (operator !== 'equals' && operator !== 'in_array') {
        return compare(resolved, tableLocales[sqlColumn]);
      }

      // A document whose read value matches has a locales row holding it, so the documents with
      // one are asked first: that is what an index on the column answers, and the comparison
      // above then runs on those alone.
      return and(
        inArray(
          table.id,
          db
            .select({ ownerId: tableLocales.ownerId })
            .from(tableLocales)
            .where(compare(tableLocales[sqlColumn]))
        ),
        compare(resolved, tableLocales[sqlColumn])
      );
    }

    // A column the base row keeps — the hierarchy columns, and any `$root()` field — reached
    // through `ownerId` when the table queried is the versions table.
    if (baseTable && baseColumns.includes(sqlColumn)) {
      return inArray(
        table.ownerId,
        db.select({ ownerId: baseTable.id }).from(baseTable).where(compare(baseTable[sqlColumn]))
      );
    }

    // Look for a relation field
    // Get document config
    const documentConfig = configCtx.getBySlug(slug);
    let fieldConfig = getFieldAtPath(column, documentConfig.fields);
    // Track relation-property detection (e.g. attributes.author.name)
    let matchedPrefix = column;
    let relationPropertyPath: string | null = null;
    let isRelationProperty = false;
    // If the exact path isn't found, try progressively shorter prefixes to support
    // relation property queries like `attributes.author.name` -> `attributes.author`
    if (!fieldConfig) {
      const parts = column.split('.');
      for (let i = parts.length - 1; i > 0; i--) {
        const prefix = parts.slice(0, i).join('.');
        const candidate = getFieldAtPath(prefix, documentConfig.fields);
        if (candidate) {
          fieldConfig = candidate;
          matchedPrefix = prefix;
          relationPropertyPath = parts.slice(i).join('.');
          isRelationProperty = true;
          break;
        }
      }
    }

    // If still not found or not a relation field, log warning and return false condition
    if (!isRelationField(fieldConfig)) {
      const message = `the query contains the field "${column}", not found for ${documentConfig.slug} document`;
      logger.warn(message);
      // Return a condition that will always be false instead of returning false
      // This ensures no documents match when a non-existent field is queried
      return eq(table.id, '-1');
    }

    // Helper: normalize various input forms (rawValue, CSV string, or formatted array)
    // into a unique array of values used for multi-valued relation comparisons.
    const normalizeValues = (raw: any, formatted: any) => {
      let out;
      if (Array.isArray(raw)) out = raw;
      else if (typeof raw === 'string' && raw.includes(',')) out = raw.split(',');
      else if (Array.isArray(formatted)) out = formatted;
      else out = [formatted];
      return Array.from(new Set(out));
    };

    // Handle relation property queries (e.g., attributes.author.name)
    // by building a subquery on the related collection
    const buildRelationPropertyCondition = () => {
      const relatedSlug = fieldConfig.get.relationTo as PrototypeSlug;
      // A versioned target keeps its fields on its versions table: match a version, answer its
      // document. A document matches when any of its versions holds the value, a draft included.
      const versions = configCtx.getBySlug(relatedSlug)._versions;
      const searched = versions ? (versions.slug as PrototypeSlug) : relatedSlug;
      const searchedTable = getTable(baseTableName(searched));

      // Build a where clause for the related collection using the same operator/value
      const relatedWhere = { [relationPropertyPath!]: { [operator]: rawValue } } as any;
      // Recursive call to buildWhereParam for the related collection
      const relatedCondition = buildWhereParam({
        query: { where: relatedWhere } as any,
        slug: searched,
        base: versions ? relatedSlug : undefined,
        db,
        locale,
        tables,
        configCtx
      });

      // Subquery of related document ids that match the property condition
      const matchingRelatedIds = db
        .select({ id: versions ? searchedTable.ownerId : searchedTable.id })
        .from(searchedTable)
        .where(relatedCondition);

      const relsTable = getTable(
        tableName({ owner: baseTableName(slug), child: { kind: 'rels' } })
      );
      // Join relation rows to documents by matching the related id and the relation path
      const ownersWithMatching = db
        .select({ id: relsTable.ownerId })
        .from(relsTable)
        .where(
          and(
            inArray(relsTable[junctionKey(relatedSlug)], matchingRelatedIds),
            eq(relsTable.path, matchedPrefix),
            ...(fieldConfig.get.localized ? [eq(relsTable.locale, locale)] : [])
          )
        );

      return inArray(table.id, ownersWithMatching);
    };

    // If this is a relation property query, delegate to the relation property handler
    if (isRelationProperty && relationPropertyPath) {
      return buildRelationPropertyCondition();
    }

    // Handle direct relation field queries (e.g., attributes.author)
    // only support a subset of operators for multi-valued relations
    const supportedRelationManyOperators = ['equals', 'not_equals', 'in_array', 'not_in_array'];

    if (fieldConfig.get.many && !supportedRelationManyOperators.includes(operator)) {
      const unsupportedMessage = `the operator "${operator}" is not supported for multi-valued relation field "${column}" in ${documentConfig.slug} document`;
      logger.warn(unsupportedMessage);
      // Return a condition that will always be false
      return eq(table.id, '-1');
    }

    // Build relation condition
    const [to, localized, many] = [
      fieldConfig.get.relationTo,
      fieldConfig.get.localized,
      fieldConfig.get.many
    ];
    const relsTableName = tableName({ owner: baseTableName(slug), child: { kind: 'rels' } });
    const relsTable = getTable(relsTableName);

    // Helpers for building common relation-owner subqueries (operate on the relations table)
    const buildOwnersWithTotalCount = (count: number) =>
      db
        .select({ id: relsTable.ownerId })
        .from(relsTable)
        .where(
          and(eq(relsTable.path, column), ...(localized ? [eq(relsTable.locale, locale)] : []))
        )
        .groupBy(relsTable.ownerId)
        .having(drizzleORM.eq(drizzleORM.count(relsTable.id), count));

    // Owners that have total relation count equal to the number of provided values
    const buildOwnersWithMatchingCount = (values: any[]) =>
      db
        .select({ id: relsTable.ownerId })
        .from(relsTable)
        .where(
          and(
            drizzleORM.inArray(relsTable[junctionKey(to)], values),
            eq(relsTable.path, column),
            ...(localized ? [eq(relsTable.locale, locale)] : [])
          )
        )
        .groupBy(relsTable.ownerId)
        .having(drizzleORM.eq(drizzleORM.count(relsTable.id), values.length));

    // Owners that have at least one relation row NOT in the provided values
    const buildOwnersWithNonMatching = (values: any[]) =>
      db
        .select({ id: relsTable.ownerId })
        .from(relsTable)
        .where(
          and(
            drizzleORM.notInArray(relsTable[junctionKey(to)], values),
            eq(relsTable.path, column),
            ...(localized ? [eq(relsTable.locale, locale)] : [])
          )
        )
        .groupBy(relsTable.ownerId)
        .having(drizzleORM.gt(drizzleORM.count(relsTable.id), 0));

    // Owners that have any relation rows (to exclude docs with no relations)
    const buildOwnersWithRelations = () =>
      db
        .select({ id: relsTable.ownerId })
        .from(relsTable)
        .where(
          and(eq(relsTable.path, column), ...(localized ? [eq(relsTable.locale, locale)] : []))
        )
        .groupBy(relsTable.ownerId)
        .having(drizzleORM.gt(drizzleORM.count(relsTable.id), 0));

    // Handle multi-valued relations specially when operator is `equals` to provide
    // strict equality semantics (the relation set must equal the provided value(s)).
    if (many && operator === 'equals') {
      // Accept various input forms and normalize to a unique array
      const values = normalizeValues(rawValue, value);
      // Owners with total relation count equal to values.length
      const ownersWithTotalCount = buildOwnersWithTotalCount(values.length);
      // Owners with matching relations count equal to values.length
      const ownersWithMatchingCount = buildOwnersWithMatchingCount(values);
      return and(
        inArray(table.id, ownersWithTotalCount),
        inArray(table.id, ownersWithMatchingCount)
      );
    }

    // For multi-valued relations, allow `in_array` to act as a subset check:
    // The provided values must contain ALL relation values of the document.
    if (many && operator === 'in_array') {
      // Accept various input forms and normalize to a unique array
      const values = normalizeValues(rawValue, value);
      // Owners that have at least one relation row not included in the provided set
      const ownersWithNonMatching = buildOwnersWithNonMatching(values);
      // Owners that have any relation rows (to exclude docs with no relations)
      const ownersWithRelations = buildOwnersWithRelations();
      // Match documents that have relations and do NOT have any non-matching relation rows
      return and(
        drizzleORM.notInArray(table.id, ownersWithNonMatching),
        inArray(table.id, ownersWithRelations)
      );
    }

    // For multi-valued relations, `not_in_array` should match documents where the provided
    // set does NOT contain all of the document's relation values (inverse of `in_array`).
    if (many && operator === 'not_in_array') {
      // Accept various input forms and normalize to a unique array
      const values = normalizeValues(rawValue, value);
      const ownersWithNonMatching = buildOwnersWithNonMatching(values);
      return inArray(table.id, ownersWithNonMatching);
    }

    // For multi-valued relations, `not_equals` is the inverse of `equals` (exact-set inequality)
    if (many && operator === 'not_equals') {
      // Accept various input forms and normalize to a unique array
      const values = normalizeValues(rawValue, value);
      const ownersWithTotalCount = buildOwnersWithTotalCount(values.length);
      const ownersWithMatchingCount = buildOwnersWithMatchingCount(values);
      return or(
        drizzleORM.notInArray(table.id, ownersWithTotalCount),
        drizzleORM.notInArray(table.id, ownersWithMatchingCount)
      );
    }

    // Handle single-valued relations and other operators
    // Default behavior (membership checks with in_array etc.)
    const conditions = [
      eq(relsTable.path, column),
      compare(relsTable[junctionKey(to)]),
      ...(localized ? [eq(relsTable.locale, locale)] : [])
    ];

    return inArray(
      table.id,
      db
        .select({ id: relsTable.ownerId })
        .from(relsTable)
        .where(and(...conditions))
    );
  };

  return buildCondition(query.where as Dic);
};

/**
 * Each REST operator as a condition on a column. SQLite's `LIKE` already ignores the case of
 * ASCII letters, so `ilike` is `like`. A range is its two bounds, `[min, max]`.
 */
const operators: Record<string, (column: any, value: any) => SQL> = {
  equals: drizzleORM.eq,
  not_equals: drizzleORM.ne,
  in_array: drizzleORM.inArray,
  not_in_array: drizzleORM.notInArray,
  like: drizzleORM.like,
  ilike: drizzleORM.like,
  not_like: drizzleORM.notLike,
  between: (column, [min, max]) => drizzleORM.between(column, min, max),
  not_between: (column, [min, max]) => drizzleORM.notBetween(column, min, max),
  is_not_null: drizzleORM.isNotNull,
  is_null: drizzleORM.isNull,
  less_than_or_equals: drizzleORM.lte,
  less_than: drizzleORM.lt,
  greater_than_or_equals: drizzleORM.gte,
  greater_than: drizzleORM.gt
};

const isOperator = (str: string) => Object.keys(operators).includes(str);

/** The operators that compare a column with a text pattern. */
const LIKE_OPERATORS = ['like', 'ilike', 'not_like'];

/**
 * The value as its operator takes it: a list for `in_array`, two bounds for `between`, a pattern
 * for `like`, nothing for a null check. Its type is the column's business — see `castTo`.
 *
 * ```ts
 * formatValue({ operator: 'in_array', value: 'a,b' }) // ['a', 'b']
 * formatValue({ operator: 'like', value: 'home' })    // '%home%'
 * ```
 */
const formatValue = ({ operator, value }: { operator: string; value: unknown }) => {
  if (['in_array', 'not_in_array'].includes(operator)) {
    return Array.isArray(value) ? value : String(value).split(',');
  }
  if (['between', 'not_between'].includes(operator)) {
    // `1,10` from a URL, or `[1, 10]` from code
    const bounds = Array.isArray(value) ? value : String(value).split(',');
    if (bounds.length !== 2) {
      throw new RimeError(RimeError.INVALID_DATA, `${operator} takes two values, got "${value}"`);
    }
    return bounds;
  }
  if (LIKE_OPERATORS.includes(operator)) {
    const pattern = String(value);
    return pattern.includes('%') ? pattern : `%${pattern}%`;
  }
  if (['is_null', 'is_not_null'].includes(operator)) return undefined;
  return value;
};

/**
 * A value from a URL as `column` stores it: a number for a number column, `true`/`false` for a
 * boolean (sent as `true`/`false` or `1`/`0`), a `Date` for a timestamp. A text column keeps the
 * string as sent, `'007'` included.
 */
const castTo = (column: { dataType: string }, value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((one) => castTo(column, one));
  if (typeof value !== 'string') return value;
  if (column.dataType.startsWith('number') && value.trim() !== '' && !isNaN(Number(value))) {
    return Number(value);
  }
  if (column.dataType === 'boolean' && ['true', 'false', '1', '0'].includes(value)) {
    return value === 'true' || value === '1';
  }
  if (column.dataType === 'object date') {
    if (isNaN(Date.parse(value))) {
      throw new RimeError(RimeError.INVALID_DATA, `"${value}" is not a date`);
    }
    return new Date(value);
  }
  return value;
};

// Extract column, operator, and raw value from condition object
function getConditionMembers(obj: Dic) {
  const [column, operatorObj] = Object.entries(obj)[0];
  const [operator, rawValue] = Object.entries(operatorObj)[0];
  if (!isOperator(operator)) {
    throw new RimeError(RimeError.INVALID_DATA, operator + ' is not supported');
  }
  // get the correct Drizzle operator
  const fn = operators[operator];
  const sqlColumn = pathToDatabaseColumn(column);
  // Shaped for its operator: a list, two bounds or a pattern
  const value = formatValue({ operator, value: rawValue });
  return { column, sqlColumn, fn, operator, rawValue, value };
}

/**
 * The condition as a versions table reads it, as a new object: `id` names the document, which is
 * the row's `ownerId`, and `versionId` names the row itself, its `id`. Other tables read it as is.
 *
 * ```ts
 * normalizedForShadow({ versionId: { equals: 'v1' } }, true) // { id: { equals: 'v1' } }
 * ```
 */
function normalizedForShadow(conditionObject: Dic, isShadow: boolean): Dic {
  if (!isShadow) return conditionObject;
  const { id, versionId, ...rest } = conditionObject;
  return {
    ...rest,
    ...(id !== undefined && { ownerId: id }),
    ...(versionId !== undefined && { id: versionId })
  };
}
