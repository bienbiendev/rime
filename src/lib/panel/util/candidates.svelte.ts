import type { BuiltCollection } from '#lib/core/config/types.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import { apiUrl } from '#lib/core/routes/util.js';
import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
import qs from 'qs';

/**
 * The reads of the document pickers: their saved picks, the documents they offer and how many.
 * Each goes through the API proxy, so a save's `invalidate` refreshes it and a locale switch reads
 * it anew. Called while the component initialises: they read the API proxy's context.
 */

/** The most documents a search lists. */
export const SEARCH_LIMIT = 20;

/** The pause in typing before a search is read. */
const SEARCH_PAUSE = 250;

export type PickerWhere = {
  config: Pick<BuiltCollection, 'kebab' | 'asTitle'>;
  /** The picker's own query string, `where[mimeType][like]=image%`, or none. */
  query?: string;
  /** The ids left out: the picks. */
  exclude?: string[];
  /** Only the documents whose title holds this text. */
  search?: string;
};

/** The `where` of a picker's reads: its query, the picks left out, the title search. */
function whereOf({ config, query = '', exclude = [], search }: PickerWhere) {
  const and = [
    qs.parse(query).where,
    exclude.length && { id: { not_in_array: exclude } },
    search && { [config.asTitle]: { like: `%${search}%` } }
  ].filter(Boolean);
  return and.length ? { and } : undefined;
}

/**
 * The saved picks: every id at once, sorted, so a new order of the same picks reads nothing.
 *
 * ```ts
 * picksURL(targets, ['b', 'a'])
 * // /api/targets?where[id][in_array][0]=a&where[id][in_array][1]=b&depth=1, brackets encoded
 * ```
 */
export const picksURL = (config: PickerWhere['config'], ids: string[]) => {
  const where = { id: { in_array: [...ids].sort() } };
  return `${apiUrl(config.kebab)}?${qs.stringify({ where, depth: 1 })}`;
};

/** The first `SEARCH_LIMIT` documents the picker offers; a live form reads them at depth 1. */
export const candidatesURL = (where: PickerWhere, depth?: number) => {
  const params = qs.stringify({ where: whereOf(where), limit: SEARCH_LIMIT, depth });
  return `${apiUrl(where.config.kebab)}?${params}`;
};

/** How many documents the picker could offer, through the collection's count route. */
export const countURL = (where: PickerWhere) => {
  const params = qs.stringify({ where: whereOf(where) });
  return `${apiUrl(where.config.kebab)}/count${params ? `?${params}` : ''}`;
};

/**
 * Reads `url` through the API proxy while it is set. While a new url loads, `data` keeps the last
 * answer, so a list or a count does not blank between two reads. A search's read leaves the cache
 * once the search changes or the picker closes, so past searches are not refreshed for the page's
 * life.
 *
 * ```ts
 * const area = useRead<{ doc: GenericDoc }>(() => ({ url: apiUrl('settings') }));
 * area.data?.doc;
 * ```
 */
export function useRead<T>(read: () => { url: string | null; search?: string }) {
  const APIProxy = getAPIProxyContext();

  // A string and a boolean: the resource changes only when the url does
  const url = $derived(read().url);
  const searched = $derived(!!read().search);
  const resource = $derived(url ? APIProxy.getRessource<T>(url) : null);

  let last = $state.raw<T | null>(null);
  $effect(() => {
    if (resource?.data) last = resource.data;
  });

  $effect(() => {
    if (!url || !searched) return;
    const current = url;
    return () => APIProxy.drop(current);
  });

  return {
    /** The answer, the last one while a new url loads; `null` when the read failed. */
    get data(): T | null {
      if (!resource) return null;
      return resource.data ?? (resource.isLoading ? last : null);
    },
    /** The read of the current url has answered, or failed. */
    get answered() {
      return !!resource && !resource.isLoading;
    }
  };
}

/**
 * A collection's documents by id, in the order of `ids`. Until the read answers, a pick is drawn
 * from the last answer or from `known`, the docs the picker holds: picked from a list, uploaded or
 * just created. Once the read answers, its docs alone are drawn, so a save's `invalidate` stays
 * the source of truth.
 *
 * ```ts
 * const picks = usePicks(() => ({ config, ids: ['a', 'b'], known: [b] }));
 * picks.docs; // [b] at once, [a, b] once read
 * picks.ready; // the read has answered
 * ```
 */
export function usePicks(
  options: () => { config: PickerWhere['config']; ids: string[]; known?: GenericDoc[] }
) {
  const read = useRead<{ docs: GenericDoc[] }>(() => {
    const { config, ids } = options();
    return { url: ids.length ? picksURL(config, ids) : null };
  });

  return {
    /** The docs in the order of `ids`; one that cannot be read is left out. */
    get docs() {
      const { ids, known = [] } = options();
      const answer = read.data?.docs ?? [];
      const held = read.answered ? answer : [...answer, ...known];
      return ids.flatMap((id) => held.find((doc) => doc.id === id) ?? []);
    },
    get ready() {
      return !options().ids.length || read.answered;
    }
  };
}

/**
 * How many documents match, read while `open`.
 *
 * ```ts
 * const left = useCount(() => ({ open: true, config, exclude: ['a'] }));
 * left.count; // null until the read answers
 * ```
 */
export function useCount(options: () => PickerWhere & { open: boolean }) {
  const read = useRead<{ count: number }>(() => {
    const { open, ...where } = options();
    return { url: open ? countURL(where) : null, search: where.search };
  });

  return {
    get count() {
      return read.data?.count ?? null;
    }
  };
}

/**
 * The documents a picker offers, read while it is open: the first `SEARCH_LIMIT` whose title holds
 * the search once typing pauses, and how many match in all.
 *
 * ```ts
 * const found = useCandidates(() => ({ open, config, search }));
 * found.docs; // the first 20, null until the read answers
 * found.count; // 143
 * ```
 */
export function useCandidates(
  options: () => PickerWhere & { open: boolean; search: string; depth?: number }
) {
  /** The search once typing pauses. */
  let text = $state('');
  $effect(() => {
    const value = options().search.trim();
    const timer = setTimeout(() => (text = value), SEARCH_PAUSE);
    return () => clearTimeout(timer);
  });

  const read = useRead<{ docs: GenericDoc[] }>(() => {
    const { open, depth, ...where } = options();
    return { url: open ? candidatesURL({ ...where, search: text }, depth) : null, search: text };
  });
  const total = useCount(() => ({ ...options(), search: text }));

  return {
    get docs() {
      return read.data?.docs ?? null;
    },
    get count() {
      return total.count;
    }
  };
}
