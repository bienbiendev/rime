import { API_PREFIX } from '$lib/core/routes/constants.js';
import { toKebabCase } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';

const cache = new Map<string, Promise<Dic | null>>();

/**
 * A document by its collection and id, as the API answers it at depth 1: one request per
 * document for the page's life, `null` when the request fails.
 *
 * ```ts
 * fetchDoc('blogPosts', 'p1') // GET /api/blog-posts/p1?depth=1
 * ```
 */
export function fetchDoc(slug: string, id: string): Promise<Dic | null> {
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

/** Forgets the documents fetched so far: the next request for each goes to the API again. */
export const clearFetchedDocs = () => cache.clear();
