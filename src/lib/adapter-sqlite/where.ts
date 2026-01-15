import { RimeError } from '$lib/core/errors/index.js';
import { getFieldConfigByPath } from '$lib/core/fields/util.js';
import { logger } from '$lib/core/logger/index.server.js';
import { hasVersionsSuffix, withLocalesSuffix } from '$lib/core/naming.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import { isRelationField } from '$lib/fields/relation/index.js';
import { type GetRegisterType } from '$lib/index.js';
import type { Dic } from '$lib/util/types.js';
import * as drizzleORM from 'drizzle-orm';
import { and, eq, getTableColumns, inArray, or } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { ParsedQs } from 'qs';
import type { PrototypeSlug } from '../types.js';
import type { GenericTable } from './types.js';

type BuildWhereArgs = {
	query: ParsedQs;
	slug: PrototypeSlug;
	locale?: string;
	db: LibSQLDatabase<GetRegisterType<'Schema'>>;
	draft?: boolean;
	tables: GetRegisterType<'Tables'>;
	configCtx: ConfigContext;
};

export const buildWhereParam = ({ query, slug, db, locale, tables, configCtx }: BuildWhereArgs) => {
	// Helper to get table by key with correct typing
	function getTable<T>(key: string) {
		return tables[key as keyof typeof tables] as T extends any ? GenericTable : T;
	}

	function getTablesAndColumns(slug: string) {
		// Get main table and localized table if applicable
		const table = getTable(slug);
		const tableNameLocales = withLocalesSuffix(slug);
		const tableLocales = getTable(tableNameLocales);

		// Get localized and unlocalized columns
		const localizedColumns = locale && tableNameLocales in tables ? Object.keys(getTableColumns(tableLocales)) : [];
		const unlocalizedColumns = Object.keys(getTableColumns(table));

		return { table, tableLocales, localizedColumns, unlocalizedColumns };
	}

	const {
		// Get main table and localized table if applicable
		table,
		tableLocales,
		localizedColumns,
		unlocalizedColumns
	} = getTablesAndColumns(slug);

	const buildCondition = (conditionObject: Dic): any | false => {
		// Handle nested AND conditions
		if ('and' in conditionObject && Array.isArray(conditionObject.and)) {
			const subConditions = conditionObject.and.map((condition) => buildCondition(condition as Dic)).filter(Boolean);
			return subConditions.length ? and(...subConditions) : false;
		}

		// Handle nested OR conditions
		if ('or' in conditionObject && Array.isArray(conditionObject.or)) {
			const subConditions = conditionObject.or.map((condition) => buildCondition(condition as Dic)).filter(Boolean);
			return subConditions.length ? or(...subConditions) : false;
		}

		conditionObject = normalizedForVersion(conditionObject, slug);

		const {
			// Get condition members
			column,
			sqlColumn,
			fn,
			operator,
			rawValue,
			value
		} = getConditionMembers(conditionObject);

		// Handle hierarchy fields (_parent, _position) in versioned collections
		if (shouldHandleVersionedHierarchyFields(slug, sqlColumn)) {
			// Get the root table name by removing the '_versions' suffix
			const rootSlug = slug.replace('_versions', '');
			const rootTable = getTable(rootSlug);
			// Query the root table for the hierarchy field
			return inArray(
				table.ownerId,
				db.select({ ownerId: rootTable.id }).from(rootTable).where(fn(rootTable[sqlColumn], value))
			);
		}

		// Handle regular fields
		if (unlocalizedColumns.includes(sqlColumn)) {
			return fn(table[sqlColumn], value);
		}

		// Handle localized fields
		if (locale && localizedColumns.includes(sqlColumn)) {
			return inArray(
				table.id,
				db
					.select({ id: tableLocales.ownerId })
					.from(tableLocales)
					.where(and(fn(tableLocales[sqlColumn], value), eq(tableLocales.locale, locale)))
			);
		}

		// Look for a relation field
		// Get document config
		const documentConfig = configCtx.getBySlug(slug);
		// Get the compiled fields for lookups
		const compiledFields = documentConfig.fields.map((f) => f.compile());
		let fieldConfig = getFieldConfigByPath(column, compiledFields);
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
				const candidate = getFieldConfigByPath(prefix, compiledFields);
				if (candidate) {
					fieldConfig = candidate;
					// If prefix shorter than original column, record the property suffix
					if (i < parts.length) {
						matchedPrefix = prefix;
						relationPropertyPath = parts.slice(i).join('.');
						isRelationProperty = true;
					}
					break;
				}
			}
		}

		// If still not found or not a relation field, log warning and return false condition
		if (!fieldConfig || !isRelationField(fieldConfig)) {
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
			const relatedSlug = fieldConfig.relationTo;
			const relatedTable = getTable(relatedSlug as any);

			// Build a where clause for the related collection using the same operator/value
			const relatedWhere = { [relationPropertyPath!]: { [operator]: rawValue } } as any;
			// Recursive call to buildWhereParam for the related collection
			const relatedCondition = buildWhereParam({
				query: { where: relatedWhere } as any,
				slug: relatedSlug as PrototypeSlug,
				db,
				locale,
				tables,
				configCtx
			});

			if (!relatedCondition) {
				// No documents in related collection match => no parent documents match
				return eq(table.id, '-1');
			}

			// Subquery of related document ids that match the property condition
			const matchingRelatedIds = db.select({ id: relatedTable.id }).from(relatedTable).where(relatedCondition);

			const relsTable = getTable(`${slug}Rels`);
			// Join relation rows to documents by matching the related id and the relation path
			const ownersWithMatching = db
				.select({ id: relsTable.ownerId })
				.from(relsTable)
				.where(
					and(
						inArray(relsTable[`${relatedSlug}Id`], matchingRelatedIds),
						eq(relsTable.path, matchedPrefix),
						...(fieldConfig.localized ? [eq(relsTable.locale, locale)] : [])
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
		// Unsupported operator for multi-valued relations :
		const supportedRelationManyOperators = ['equals', 'not_equals', 'in_array', 'not_in_array'];
		// Only enforce the restriction for direct relation field queries.
		// If this is a relation property query (e.g. attributes.author.name) we allow
		// any operator because those will be applied to the related collection.
		if (fieldConfig.many && !supportedRelationManyOperators.includes(operator)) {
			const unsupportedMessage = `the operator "${operator}" is not supported for multi-valued relation field "${column}" in ${documentConfig.slug} document`;
			logger.warn(unsupportedMessage);
			// Return a condition that will always be false
			return eq(table.id, '-1');
		}

		// Build relation condition
		const [to, localized] = [fieldConfig.relationTo, fieldConfig.localized];
		const relsTableName = `${slug}Rels`;
		const relsTable = getTable(relsTableName);

		// Helpers for building common relation-owner subqueries (operate on the relations table)
		const buildOwnersWithTotalCount = (count: number) =>
			db
				.select({ id: relsTable.ownerId })
				.from(relsTable)
				.where(and(eq(relsTable.path, column), ...(localized ? [eq(relsTable.locale, locale)] : [])))
				.groupBy(relsTable.ownerId)
				.having(drizzleORM.eq(drizzleORM.count(relsTable.id), count));

		// Owners that have total relation count equal to the number of provided values
		const buildOwnersWithMatchingCount = (values: any[]) =>
			db
				.select({ id: relsTable.ownerId })
				.from(relsTable)
				.where(
					and(
						drizzleORM.inArray(relsTable[`${to}Id`], values),
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
						drizzleORM.notInArray(relsTable[`${to}Id`], values),
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
				.where(and(eq(relsTable.path, column), ...(localized ? [eq(relsTable.locale, locale)] : [])))
				.groupBy(relsTable.ownerId)
				.having(drizzleORM.gt(drizzleORM.count(relsTable.id), 0));

		// Handle multi-valued relations specially when operator is `equals` to provide
		// strict equality semantics (the relation set must equal the provided value(s)).
		if (fieldConfig.many && operator === 'equals') {
			// Accept various input forms and normalize to a unique array
			const values = normalizeValues(rawValue, value);
			// Owners with total relation count equal to values.length
			const ownersWithTotalCount = buildOwnersWithTotalCount(values.length);
			// Owners with matching relations count equal to values.length
			const ownersWithMatchingCount = buildOwnersWithMatchingCount(values);
			return and(inArray(table.id, ownersWithTotalCount), inArray(table.id, ownersWithMatchingCount));
		}

		// For multi-valued relations, allow `in_array` to act as a subset check:
		// The provided values must contain ALL relation values of the document.
		if (fieldConfig.many && operator === 'in_array') {
			// Accept various input forms and normalize to a unique array
			const values = normalizeValues(rawValue, value);
			// Owners that have at least one relation row not included in the provided set
			const ownersWithNonMatching = buildOwnersWithNonMatching(values);
			// Owners that have any relation rows (to exclude docs with no relations)
			const ownersWithRelations = buildOwnersWithRelations();
			// Match documents that have relations and do NOT have any non-matching relation rows
			return and(drizzleORM.notInArray(table.id, ownersWithNonMatching), inArray(table.id, ownersWithRelations));
		}

		// For multi-valued relations, `not_in_array` should match documents where the provided
		// set does NOT contain all of the document's relation values (inverse of `in_array`).
		if (fieldConfig.many && operator === 'not_in_array') {
			// Accept various input forms and normalize to a unique array
			const values = normalizeValues(rawValue, value);
			const ownersWithNonMatching = buildOwnersWithNonMatching(values);
			return inArray(table.id, ownersWithNonMatching);
		}

		// For multi-valued relations, `not_equals` is the inverse of `equals` (exact-set inequality)
		if (fieldConfig.many && operator === 'not_equals') {
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
			fn(relsTable[`${to}Id`], value),
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

const operators: Record<string, any> = {
	equals: drizzleORM.eq,
	not_equals: drizzleORM.ne,
	in_array: drizzleORM.inArray,
	like: drizzleORM.like,
	ilike: drizzleORM.ilike,
	between: drizzleORM.between,
	not_between: drizzleORM.notBetween,
	not_like: drizzleORM.notLike,
	not_in_array: drizzleORM.notInArray,
	is_not_null: drizzleORM.isNotNull,
	is_null: drizzleORM.isNull,
	less_than_or_equals: drizzleORM.lte,
	less_than: drizzleORM.lt,
	greater_than_or_equals: drizzleORM.gte,
	greater_than: drizzleORM.gt
};

const isOperator = (str: string) => Object.keys(operators).includes(str);

// Format value based on operator and type
const formatValue = ({ operator, value }: { operator: string; value: any }) => {
	switch (true) {
		case typeof value === 'string' &&
			/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/.test(value):
			return new Date(value);
		case ['in_array', 'not_in_array'].includes(operator):
			// Value is an array do nothing
			if (Array.isArray(value)) return value;
			// Handle string value with "," separators for url params
			return value.split(',');
		case ['like', 'ilike', 'not_like'].includes(operator):
			return !value.includes('%') ? `%${value}%` : value;
		default:
			return value;
	}
};

// Extract column, operator, and raw value from condition object
function getConditionMembers(obj: Dic) {
	const [column, operatorObj] = Object.entries(obj)[0];
	const [operator, rawValue] = Object.entries(operatorObj)[0];
	if (!isOperator(operator)) {
		throw new RimeError(RimeError.INVALID_DATA, operator + 'is not supported');
	}
	// get the correct Drizzle operator
	const fn = operators[operator];
	// Convert dot notation to double underscore
	// for fields included in groups or tabs
	const sqlColumn = column.replace(/\./g, '__');
	// Format compared value to support Date, Arrays,...
	const value = formatValue({ operator, value: rawValue });
	return { column, sqlColumn, fn, operator, rawValue, value };
}

// Determine if we should handle versioned hierarchy fields
function shouldHandleVersionedHierarchyFields(slug: string, sqlColumn: string) {
	return hasVersionsSuffix(slug) && (sqlColumn === '_parent' || sqlColumn === '_position' || sqlColumn === '_path');
}

// Normalize condition object for versioned collections
function normalizedForVersion(conditionObject: Dic, slug: string): Dic {
	// Handle id field for versioned collections
	// if "id" inside the query it should refer to the root table
	if (hasVersionsSuffix(slug) && 'id' in conditionObject) {
		// Replace id with ownerId and keep the same operator and value
		const idOperator = conditionObject.id;
		delete conditionObject.id;
		conditionObject.ownerId = idOperator;
	}
	// Handle versionId field for versioned collections
	// if "versionId" inside the query it should refer to the id of the version table (current)
	if (hasVersionsSuffix(slug) && 'versionId' in conditionObject) {
		// Replace id with ownerId and keep the same operator and value
		const idOperator = conditionObject.versionId;
		delete conditionObject.versionId;
		conditionObject.id = idOperator;
	}
	return conditionObject;
}
