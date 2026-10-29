import { pathToDatabaseColumn } from './columns.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { getFieldAtPath } from '#lib/core/fields/util.js';
import { logger } from '#lib/core/logger.server.js';
import type { ConfigContext } from '#lib/core/rime.server.js';
import { isRelationField, type RelationFieldBuilder } from '#lib/fields/relation/index.js';
import { type GetRegisterType } from '#lib/index.js';
import { isObjectLiteral } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import * as drizzleORM from 'drizzle-orm';
import { and, eq, getTableColumns, inArray, notInArray, or, type SQL } from 'drizzle-orm';
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

/**
 * A REST `where` as one drizzle condition on `slug`'s table. A key is a document path
 * (`attributes.title`), a field of a related document (`author.name`), `url`, or `and`/`or`
 * holding a list. Several keys, or several operators on one key, must all match. With `base`,
 * `slug` is that prototype's versions table: `id` then means the document and `versionId` the
 * row. `false` for an empty `and`/`or`.
 *
 * ```ts
 * buildWhereParam({ query: { where: { 'attributes.title': { like: 'home' } } }, slug: 'pages', … })
 * ```
 */
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

  /**
   * The table of `slug`, its locales branch, and their column names. No localized column
   * without a `locale`.
   */
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

  /** The addresses of a collection with `$url`, kept off the base table. */
  const pathsTable = getTable(
    tableName({ owner: baseTableName(base ?? slug), child: { kind: 'paths' } })
  );
  /** The junction rows of `slug`'s relation fields. */
  const relsTable = getTable(tableName({ owner: baseTableName(slug), child: { kind: 'rels' } }));

  /**
   * One condition: an `and`/`or` list, or `{ path: { operator: value } }` resolved against, in
   * this order, the paths table (`url`, `_urlPath`), a column of the table, a localized column, a
   * base-row column of a versions table, and a relation field. A path none of them knows matches
   * nothing.
   */
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

    if (Array.isArray(conditionObject.and)) return combine(and, conditionObject.and);
    if (Array.isArray(conditionObject.or)) return combine(or, conditionObject.or);

    const condition = getConditionMembers(normalizedForShadow(conditionObject, isShadow));
    return (
      pathsCondition(condition) ??
      columnCondition(condition) ??
      localizedCondition(condition) ??
      baseColumnCondition(condition) ??
      relationCondition(condition)
    );
  };

  /** `join` of the conditions of a list; `false` when none is left. */
  const combine = (join: typeof and, list: Dic[]) => {
    const conditions = list.map((condition) => buildCondition(condition)).filter(Boolean);
    return conditions.length ? join(...conditions) : false;
  };

  /** A condition no row meets, with the reason in the log. */
  const matchNothing = (reason: string) => {
    logger.warn(reason);
    return eq(table.id, '-1');
  };

  // Each kind of path below answers a condition, or `undefined` for a path of another kind.

  /**
   * `url` or `_urlPath` of a collection with `$url`: its pages found by url or by path through
   * its paths table, in the locale read. A versions table is matched through its `ownerId`, like
   * any base-row filter.
   */
  const pathsCondition = ({ column, compare }: Condition) => {
    if (!pathsTable || (column !== 'url' && column !== '_urlPath')) return undefined;
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
  };

  /** A column of the table itself. */
  const columnCondition = ({ sqlColumn, compare }: Condition) =>
    unlocalizedColumns.includes(sqlColumn) ? compare(table[sqlColumn]) : undefined;

  /**
   * A localized column, compared as a read would show it: the first locale in the fallback order
   * that holds a value, `''` counting as none — so a page found by its slug in one locale is found
   * by the same slug in a locale it was not translated to yet.
   */
  const localizedCondition = ({ sqlColumn, operator, compare }: Condition) => {
    if (!locale || !localizedColumns.includes(sqlColumn)) return undefined;
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
  };

  /**
   * A column the base row keeps — the hierarchy columns, and any `$root()` field — reached
   * through `ownerId` when the table queried is the versions table.
   */
  const baseColumnCondition = ({ sqlColumn, compare }: Condition) => {
    if (!baseTable || !baseColumns.includes(sqlColumn)) return undefined;
    return inArray(
      table.ownerId,
      db.select({ ownerId: baseTable.id }).from(baseTable).where(compare(baseTable[sqlColumn]))
    );
  };

  /**
   * A relation field, `author`, or a field of the documents it points at, `author.name`. Any
   * other path matches nothing, and so does an operator a relation with many values cannot answer.
   */
  const relationCondition = (condition: Condition) => {
    const { column, operator, rawValue, value, compare } = condition;
    const documentConfig = configCtx.getBySlug(slug);
    const { field, path, property } = fieldAtPrefix(column, documentConfig.fields);
    if (!isRelationField(field)) {
      return matchNothing(
        `the query contains the field "${column}", not found for ${documentConfig.slug} document`
      );
    }
    if (property) return relationPropertyCondition(field, path, property, condition);

    const rows = junctionRows(column, !!field.get.localized);
    const target = relsTable[junctionKey(field.get.relationTo)];
    if (!field.get.many) {
      return inArray(
        table.id,
        db
          .select({ id: relsTable.ownerId })
          .from(relsTable)
          .where(and(...rows, compare(target)))
      );
    }

    const set = relationSets[operator];
    if (!set) {
      return matchNothing(
        `the operator "${operator}" is not supported for multi-valued relation field "${column}" in ${documentConfig.slug} document`
      );
    }
    return set(rows, target, normalizeValues(rawValue, value));
  };

  /**
   * `property` of the documents the relation at `path` points at, with the condition's operator
   * and value. A versioned target keeps its fields on its versions table: a version is matched
   * and its document answered, so a document matches when any of its versions holds the value,
   * a draft included.
   */
  const relationPropertyCondition = (
    relation: RelationFieldBuilder,
    path: string,
    property: string,
    { operator, rawValue }: Condition
  ) => {
    const relatedSlug = relation.get.relationTo as PrototypeSlug;
    const versions = configCtx.getBySlug(relatedSlug)._versions;
    const searched = versions ? (versions.slug as PrototypeSlug) : relatedSlug;
    const searchedTable = getTable(baseTableName(searched));

    const relatedCondition = buildWhereParam({
      query: { where: { [property]: { [operator]: rawValue } } } as any,
      slug: searched,
      base: versions ? relatedSlug : undefined,
      db,
      locale,
      tables,
      configCtx
    });
    const matchingIds = db
      .select({ id: versions ? searchedTable.ownerId : searchedTable.id })
      .from(searchedTable)
      .where(relatedCondition);

    const owners = db
      .select({ id: relsTable.ownerId })
      .from(relsTable)
      .where(
        and(
          inArray(relsTable[junctionKey(relatedSlug)], matchingIds),
          ...junctionRows(path, !!relation.get.localized)
        )
      );
    return inArray(table.id, owners);
  };

  /** The junction rows of the relation at `path`, those of the locale read when it is localized. */
  const junctionRows = (path: string, localized: boolean) => [
    eq(relsTable.path, path),
    ...(localized ? [eq(relsTable.locale, locale)] : [])
  ];

  /** The documents with exactly `count` of the junction rows `where` picks. */
  const ownersWithCount = (where: SQL[], count: number) =>
    db
      .select({ id: relsTable.ownerId })
      .from(relsTable)
      .where(and(...where))
      .groupBy(relsTable.ownerId)
      .having(eq(drizzleORM.count(relsTable.id), count));

  /** The documents with at least one of the junction rows `where` picks. */
  const ownersWithAny = (where: SQL[]) =>
    db
      .select({ id: relsTable.ownerId })
      .from(relsTable)
      .where(and(...where))
      .groupBy(relsTable.ownerId)
      .having(drizzleORM.gt(drizzleORM.count(relsTable.id), 0));

  /**
   * A relation with many values compared as a set, by operator. `rows` picks its junction rows,
   * `target` is their column of related ids, and `values` the ids sent.
   *
   * ```
   * equals        the same set, in any order
   * not_equals    any other set, an empty one included
   * in_array      a set inside the list, and not an empty one
   * not_in_array  a set with a value outside the list
   * ```
   */
  const relationSets: Record<string, RelationSet> = {
    equals: (rows, target, values) =>
      and(
        inArray(table.id, ownersWithCount(rows, values.length)),
        inArray(table.id, ownersWithCount([inArray(target, values), ...rows], values.length))
      ),
    not_equals: (rows, target, values) =>
      or(
        notInArray(table.id, ownersWithCount(rows, values.length)),
        notInArray(table.id, ownersWithCount([inArray(target, values), ...rows], values.length))
      ),
    in_array: (rows, target, values) =>
      and(
        notInArray(table.id, ownersWithAny([notInArray(target, values), ...rows])),
        inArray(table.id, ownersWithAny(rows))
      ),
    not_in_array: (rows, target, values) =>
      inArray(table.id, ownersWithAny([notInArray(target, values), ...rows]))
  };

  return buildCondition(query.where as Dic);
};

/** A relation with many values compared as a set: see `relationSets`. */
type RelationSet = (rows: SQL[], target: any, values: any[]) => SQL | undefined;

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

/**
 * The column, operator and value of a `{ path: { operator: value } }` condition, and `compare`,
 * its operator on a column. Only the first key, and the first operator, are read. An unknown
 * operator throws.
 */
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
  /**
   * The operator on `column`, the value cast for `cast` (the column itself, unless it is an
   * expression). A `like` pattern is text whatever the column, and is never cast.
   */
  const compare = (column: any, cast: { dataType: string } = column) =>
    fn(column, LIKE_OPERATORS.includes(operator) ? value : castTo(cast, value));
  return { column, sqlColumn, operator, rawValue, value, compare };
}

type Condition = ReturnType<typeof getConditionMembers>;

/**
 * The field at `path`, or else the field at its longest prefix and the rest of the path, a field
 * of the related document.
 *
 * ```ts
 * fieldAtPrefix('attributes.author.name', fields)
 * // { field: <attributes.author>, path: 'attributes.author', property: 'name' }
 * ```
 */
function fieldAtPrefix(path: string, fields: FieldBuilder[]) {
  const field = getFieldAtPath(path, fields);
  if (field) return { field, path, property: '' };
  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join('.');
    const candidate = getFieldAtPath(prefix, fields);
    if (candidate) return { field: candidate, path: prefix, property: parts.slice(i).join('.') };
  }
  return { field: undefined, path, property: '' };
}

/**
 * The ids a relation set is compared with, each once: the list sent, a CSV string, or one id.
 *
 * ```ts
 * normalizeValues('a,b,a', ['a', 'b', 'a']) // ['a', 'b']
 * ```
 */
function normalizeValues(raw: any, formatted: any) {
  let out;
  if (Array.isArray(raw)) {
    out = raw;
  } else if (typeof raw === 'string' && raw.includes(',')) {
    out = raw.split(',');
  } else if (Array.isArray(formatted)) {
    out = formatted;
  } else {
    out = [formatted];
  }
  return Array.from(new Set(out));
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
