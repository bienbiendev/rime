import type { Dic } from '#lib/util/types.js';
import type { RelationField } from './index.js';

/**
 * A relation field's `query()` for these form values, as a query string; `''` without one.
 *
 * ```ts
 * queryOf({ query: (doc) => `where[country][equals]=${doc.country}` }, { country: 'it' })
 * // 'where[country][equals]=it'
 * ```
 */
export const queryOf = (field: Pick<RelationField, 'query'>, values: Dic): string =>
  typeof field.query === 'function' ? field.query(values as never) : (field.query ?? '');
