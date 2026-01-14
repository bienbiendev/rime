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
	function getTable<T>(key: string) {
		return tables[key as keyof typeof tables] as T extends any ? GenericTable : T;
	}
	const table = getTable(slug);
	const tableNameLocales = withLocalesSuffix(slug);
	const tableLocales = getTable(tableNameLocales);

	const localizedColumns =
		locale && tableNameLocales in tables ? Object.keys(getTableColumns(tableLocales)) : [];
	const unlocalizedColumns = Object.keys(getTableColumns(table));

	const buildCondition = (conditionObject: Dic): any | false => {
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

		// Handle regular field conditions
		const [column, operatorObj] = Object.entries(conditionObject)[0];
		const [operator, rawValue] = Object.entries(operatorObj)[0];

		if (!isOperator(operator)) {
			throw new RimeError(RimeError.INVALID_DATA, operator + 'is not supported');
		}

		// get the correct Drizzle operator
		const fn = operators[operator];
		// Format compared value to support Date, Arrays,...
		const value = formatValue({ operator, value: rawValue });

		// Convert dot notation to double underscore
		// for fields included in groups or tabs
		const sqlColumn = column.replace(/\./g, '__');

		// Handle hierarchy fields (_parent, _position) in versioned collections
		if (
			hasVersionsSuffix(slug) &&
			(sqlColumn === '_parent' || sqlColumn === '_position' || sqlColumn === '_path')
		) {
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
		if (!documentConfig) {
			throw new Error(`${slug} not found (should never happen)`);
		}

		// Get the field config
		const fieldConfig = getFieldConfigByPath(
			column,
			documentConfig.fields.map((f) => f.compile())
		);

		if (!fieldConfig) {
			// @TODO handle relation props ex: author.email
			logger.warn(
				`the query contains the field "${column}", not found for ${documentConfig.slug} document`
			);
			// Return a condition that will always be false instead of returning false
			// This ensures no documents match when a non-existent field is queried
			return eq(table.id, '-1'); // No document will have ID = -1, so this will always be false
		}

		// Not a relation
		if (!isRelationField(fieldConfig)) {
			logger.warn(
				`the query contains the field "${column}", not found for ${documentConfig.slug} document`
			);
			// Return a condition that will always be false
			return eq(table.id, '-1'); // No document will have ID = -1, so this will always be false
		}

		// Unsupported operator for multi-valued relations
		const supportedRelationManyOperators = ['equals', 'not_equals', 'in_array', 'not_in_array'];

		if (fieldConfig.many && !supportedRelationManyOperators.includes(operator)) {
			logger.warn(
				`the operator "${operator}" is not supported for multi-valued relation field "${column}" in ${documentConfig.slug} document`
			);
			// Return a condition that will always be false
			return eq(table.id, '-1'); // No document will have ID = -1, so this will always be false
		}

		// Only compare with the relation ID for now
		// @TODO handle relation props ex: author.email
		const [to, localized] = [fieldConfig.relationTo, fieldConfig.localized];
		const relationTableName = `${slug}Rels`;
		const relationTable = getTable(relationTableName);

		// Handle multi-valued relations specially when operator is `equals` to provide
		// strict equality semantics (the relation set must equal the provided value(s)).
		if (fieldConfig.many && operator === 'equals') {
			// Accept array inputs, repeated params, or CSV values for equality checks
			let values: any[] = (() => {
				if (Array.isArray(rawValue)) return rawValue;
				if (typeof rawValue === 'string' && rawValue.includes(',')) return rawValue.split(',');
				if (Array.isArray(value)) return value;
				return [value];
			})();

			// Ensure values are unique
			values = Array.from(new Set(values));

			// Owners with total relation count equal to values.length
			const ownersWithTotalCount = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.eq(drizzleORM.count(relationTable.id), values.length));

			// Owners with matching relations count equal to values.length
			const ownersWithMatchingCount = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						drizzleORM.inArray(relationTable[`${to}Id`], values),
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.eq(drizzleORM.count(relationTable.id), values.length));
			return and(
				inArray(table.id, ownersWithTotalCount),
				inArray(table.id, ownersWithMatchingCount)
			);
		}

		// For multi-valued relations, allow `in_array` to act as a subset check:
		// The provided values must contain ALL relation values of the document.
		if (fieldConfig.many && operator === 'in_array') {
			// Accept array inputs, repeated params, or CSV values for in_array checks
			let values: any[] = (() => {
				if (Array.isArray(rawValue)) return rawValue;
				if (typeof rawValue === 'string' && rawValue.includes(',')) return rawValue.split(',');
				if (Array.isArray(value)) return value;
				return [value];
			})();

			// Ensure values are unique
			values = Array.from(new Set(values));

			// Owners that have at least one relation row not included in the provided set
			const ownersWithNonMatching = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						drizzleORM.notInArray(relationTable[`${to}Id`], values),
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.gt(drizzleORM.count(relationTable.id), 0));

			// Owners that have any relation rows (to exclude docs with no relations)
			const ownersWithRelations = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.gt(drizzleORM.count(relationTable.id), 0));

			// Match documents that have relations and do NOT have any non-matching relation rows
			return and(
				drizzleORM.notInArray(table.id, ownersWithNonMatching),
				inArray(table.id, ownersWithRelations)
			);
		}

		// For multi-valued relations, `not_in_array` should match documents where the provided
		// set does NOT contain all of the document's relation values (inverse of `in_array`).
		if (fieldConfig.many && operator === 'not_in_array') {
			let values: any[] = (() => {
				if (Array.isArray(rawValue)) return rawValue;
				if (typeof rawValue === 'string' && rawValue.includes(',')) return rawValue.split(',');
				if (Array.isArray(value)) return value;
				return [value];
			})();

			values = Array.from(new Set(values));

			const ownersWithNonMatching = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						drizzleORM.notInArray(relationTable[`${to}Id`], values),
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.gt(drizzleORM.count(relationTable.id), 0));

			return inArray(table.id, ownersWithNonMatching);
		}

		// For multi-valued relations, `not_equals` is the inverse of `equals` (exact-set inequality)
		if (fieldConfig.many && operator === 'not_equals') {
			let values: any[] = (() => {
				if (Array.isArray(rawValue)) return rawValue;
				if (typeof rawValue === 'string' && rawValue.includes(',')) return rawValue.split(',');
				if (Array.isArray(value)) return value;
				return [value];
			})();

			values = Array.from(new Set(values));

			const ownersWithTotalCount = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.eq(drizzleORM.count(relationTable.id), values.length));

			const ownersWithMatchingCount = db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
				.where(
					and(
						inArray(relationTable[`${to}Id`], values),
						eq(relationTable.path, column),
						...(localized ? [eq(relationTable.locale, locale)] : [])
					)
				)
				.groupBy(relationTable.ownerId)
				.having(drizzleORM.eq(drizzleORM.count(relationTable.id), values.length));

			return or(
				drizzleORM.notInArray(table.id, ownersWithTotalCount),
				drizzleORM.notInArray(table.id, ownersWithMatchingCount)
			);
		}

		// Default behavior (membership checks with in_array etc.)
		const conditions = [eq(relationTable.path, column), fn(relationTable[`${to}Id`], value)];

		if (localized) {
			conditions.push(eq(relationTable.locale, locale));
		}
		return inArray(
			table.id,
			db
				.select({ id: relationTable.ownerId })
				.from(relationTable)
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
