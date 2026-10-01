import { isObjectLiteral } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import { clearFetchedDocs, fetchDoc } from './fetch.js';
import { Relation } from './relation.js';

const isLink = (value: Dic) =>
  'value' in value &&
  'target' in value &&
  'type' in value &&
  !['url', 'email', 'tel', 'anchor'].includes(value.type);

/**
 * Relations and resource links resolved at depth 1, the shape the API answers with.
 * A resolved document is returned as is; a relation that cannot be fetched stays a reference.
 */
export async function populate<T>(value: T): Promise<T> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => populate(item))) as Promise<T>;
  }
  if (!isObjectLiteral(value)) return value;

  if (isLink(value)) {
    if (!value.type || !value.value) return value;
    const doc = await fetchDoc(value.type, value.value);
    return doc?.url ? { ...value, url: doc.url } : value;
  }

  if (Relation.isRef(value)) {
    if ('livePreview' in value) return value.livePreview as T;
    return ((await fetchDoc(value.relationTo, value.documentId)) ?? value) as T;
  }

  const entries = await Promise.all(
    Object.entries(value).map(async ([key, item]) => [key, await populate(item)])
  );
  return Object.fromEntries(entries) as T;
}

populate.clear = clearFetchedDocs;
