import { PARAMS } from '#lib/core/constants.js';
import { API_PREFIX } from '#lib/core/routes/constants.js';
import { toKebabCase } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';

const cache = new Map<string, Promise<Dic | null>>();

/**
 * A related document, read from the browser: the live preview's `populate` and
 * `Relation.resolve` call it. It asks the API at depth 1 in `locale`; without one the API answers
 * in the default locale. One request per document and locale for the page's life, `null` when
 * the request fails.
 *
 * ```ts
 * fetchDoc('blogPosts', 'p1', 'fr') // GET /api/blog-posts/p1?depth=1&locale=fr
 * ```
 */
export function fetchDoc(slug: string, id: string, locale?: string): Promise<Dic | null> {
  const key = `${slug}/${id}/${locale ?? ''}`;
  if (!cache.has(key)) {
    const params = new URLSearchParams({ depth: '1' });
    if (locale) {
      params.set(PARAMS.LOCALE, locale);
    }
    const url = `${API_PREFIX}/${toKebabCase(slug)}/${id}?${params}`;
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

/** Forgets the documents fetched so far: the next request for each goes to the API again. */
export const clearFetchedDocs = () => cache.clear();
