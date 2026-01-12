import { hasProps, isObjectLiteral } from '$lib/util/object';
import type { RelationValue } from '../types';

/**
 * Checks if a relation field's value is populated with full documents.
 *
 * A relation is considered populated if it is an array of objects that do not
 * contain only the relation identifiers (`id`, `relationTo`, `documentId`).
 * If the value is a string or an array of relation identifier objects,
 * it is considered not populated.
 *
 * @example
 * // Returns: false
 * isRelationPopulated('7674e91b-598a-4a72-a5cd-9594736a34dd');
 *
 * @example
 * // Returns: false
 * isRelationPopulated([]);
 *
 * @example
 * // Returns: false
 * isRelationPopulated([
 *   {
 *     id: '7674e91b-598a-4a72-a5cd-9594736a34dd',
 *     relationTo: 'articles',
 *     documentId: 'b674e91b-598a-4a72-a5cd-9594736a34dd'
 *   }
 * ]);
 */
export const isRelationPopulated = <T>(value: RelationValue<T>): value is T[] => {
	if (Array.isArray(value)) {
		if (value.length === 0) return false;

		return value.every((v) => {
			return isObjectLiteral(v) && !hasProps(['id', 'relationTo', 'documentId'], v);
		});
	}
	return typeof value !== 'string';
};
