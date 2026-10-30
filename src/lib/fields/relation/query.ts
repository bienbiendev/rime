import type { Dic } from '#lib/util/types.js';
import qs from 'qs';
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

/**
 * The docs among `docs` that the query names, read back from the collection at `url`; every doc
 * when the query has no `where`.
 *
 * ```ts
 * await namedByQuery('/api/medias', 'where[mimeType][like]=image%', [jpg, pdf]) // [jpg]
 * ```
 */
export async function namedByQuery<T extends { id: string }>(
  url: string,
  query: string,
  docs: T[]
): Promise<T[]> {
  const own = qs.parse(query).where;
  if (!own || !docs.length) return docs;
  const where = { and: [own, { id: { in_array: docs.map((doc) => doc.id) } }] };
  const response = await fetch(`${url}?${qs.stringify({ where })}`);
  if (!response.ok) return [];
  const named = new Set(((await response.json()).docs as { id: string }[]).map((doc) => doc.id));
  return docs.filter((doc) => named.has(doc.id));
}
