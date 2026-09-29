import { API_PREFIX } from '$lib/core/routes/constants.js';
import { isObjectLiteral } from '$lib/util/object.js';
import { toKebabCase } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';

const cache = new Map<string, Promise<Dic | null>>();

/** One request per document for the page's life. */
function fetchDoc(slug: string, id: string): Promise<Dic | null> {
  const key = `${slug}/${id}`;
  if (!cache.has(key)) {
    const url = `${API_PREFIX}/${toKebabCase(slug)}/${id}?depth=1`;
    cache.set(
      key,
      fetch(url)
        .then((response) => response.json())
        .then((response) => response?.doc ?? null)
        .catch((error) => {
          console.error(error);
          return null;
        })
    );
  }
  return cache.get(key)!;
}

const isLink = (value: Dic) =>
  'value' in value &&
  'target' in value &&
  'type' in value &&
  !['url', 'email', 'tel', 'anchor'].includes(value.type);

const isRelation = (value: Dic) => 'documentId' in value && 'relationTo' in value;

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

  if (isRelation(value)) {
    if ('livePreview' in value) return value.livePreview;
    return ((await fetchDoc(value.relationTo, value.documentId)) ?? value) as T;
  }

  const entries = await Promise.all(
    Object.entries(value).map(async ([key, item]) => [key, await populate(item)])
  );
  return Object.fromEntries(entries) as T;
}

populate.clear = () => cache.clear();
