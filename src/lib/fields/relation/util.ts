import { hasProps, isObjectLiteral } from '$lib/util/object.js';
import type { RelationRef, RelationValue } from '../types.js';
import type { Relation } from './index.js';

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

/**
 * Checks if a relation value is resolved (contains the actual referenced document).
 *
 * @example
 * // Returns true for a resolved relation
 * isRelationResolved({ title: 'Home Page', _prototype: 'collection', _type: 'pages' });
 */
export const isRelationResolved = <T>(value: any): value is T => {
  return value && isObjectLiteral(value) && hasProps(['title', '_prototype', '_type'], value);
};

/**
 * Checks if a relation value is a reference (contains only the relationTo and documentId).
 *
 * @example
 * // Returns true for a relation reference
 * isRelationRef({ relationTo: 'pages', documentId: '123' });
 */
export const isRelationRef = (value: unknown): value is RelationRef =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as any).relationTo === 'string' &&
  typeof (value as any).documentId === 'string';

/**
 * Checks if a relation value is unresolved (contains only reference information).
 *
 * @example
 * // Returns true for an unresolved relation
 * isRelationUnresolved({ relationTo: 'pages', documentId: '123' });
 */
export const isRelationUnresolved = (
  value: any
): value is Omit<Relation, 'path' | 'position' | 'ownerId'> => {
  return value && isObjectLiteral(value) && hasProps(['relationTo', 'documentId'], value);
};

/**
 * Resolves a relation reference to the actual document it points to.
 *
 * @example
 * // Resolves a relation reference to the actual document
 * const doc = await resolveRelationRef({ relationTo: 'pages', documentId: '123' });
 */
export async function resolveRelationRef<T>(item: T | RelationRef | string): Promise<T> {
  if (isRelationRef(item)) {
    return fetch(`api/${item.relationTo}/${item.documentId}`)
      .then((r) => r.json())
      .then((r) => r.doc);
  }
  if (typeof item === 'string') {
    throw new Error(
      `Cannot resolve relation from a bare id ("${item}") — missing "relationTo". ` +
        `resolveRelationRef only works on populated docs or { relationTo, documentId } objects.`
    );
  }
  if (isRelationResolved<T>(item)) {
    return item;
  }
  throw new Error(`Unrecognized relation shape: ${JSON.stringify(item)}`);
}

/**
 * Resolves a relation field value to the actual documents it points to.
 *
 * @example
 * // Resolves a relation value to the actual documents
 * const docs = await resolveRelation([{ relationTo: 'pages', documentId: '123' }]);
 */
export async function resolveRelation<T>(
  value: RelationValue<T> | null | undefined
): Promise<T[] | null | undefined> {
  if (value === null || value === undefined) return value;
  const items = Array.isArray(value) ? value : [value];
  return Promise.all(items.map((item) => resolveRelationRef<T>(item)));
}
