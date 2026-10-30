import { withLocale } from '#lib/panel/util/url.js';
import { getContext, setContext } from 'svelte';

/**
 * The panel's cache of API reads, one per panel root (Root.svelte, Live.svelte): each URL is
 * fetched once and shared.
 *
 * `getLocale` answers the panel's locale, which every resource names: the resource is keyed by
 * its url with that locale, so after a switch the same url is a new resource.
 */
function createAPIProxy(getLocale: () => string | undefined) {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache: each resource is reactive on its own
  const resources = new Map<string, Resource>();

  /**
   * The cached read of `url`, fetched on first ask. It is not fetched again until `invalidate`
   * names it. `transformData` shapes the JSON as it arrives; the options of the first ask stay.
   */
  function getRessource<T>(url: string, options?: GetResourcesOptions<T>) {
    const target = withLocale(url, getLocale());
    if (!resources.has(target)) {
      resources.set(target, createResource<T>(target, options));
    }
    return resources.get(target) as Resource<T>;
  }

  function createResource<T>(url: string, options?: GetResourcesOptions<T>): Resource<T> {
    let data = $state<T | null>(null);
    let isLoading = $state(true);
    let error = $state(null);
    // The number of the newest fetch: only its answer is written
    let latest = 0;

    fetchData();

    function fetchData() {
      const request = ++latest;
      isLoading = true;
      error = null;

      fetch(url, {
        method: 'GET'
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          return response.json();
        })
        .then((json) => {
          // A newer refresh started meanwhile: its answer is the one to keep
          if (request !== latest) return;
          data = options?.transformData ? options?.transformData(json) : json;
          isLoading = false;
        })
        .catch((err) => {
          if (request !== latest) return;
          error = err;
          isLoading = false;
          console.error(`Error fetching ${url}:`, err);
        });
    }

    return {
      get url() {
        return url;
      },
      get data() {
        return data;
      },
      get isLoading() {
        return isLoading;
      },
      get error() {
        return error;
      },
      refresh() {
        fetchData();
      }
    };
  }

  /**
   * Fetches again every cached read whose URL contains `pattern`, or matches it as a regex.
   *
   * ```ts
   * invalidate('/api/pages') // also /api/pages-versions?… and /api/pages-categories
   * ```
   */
  function invalidate(pattern: string | RegExp) {
    resources.forEach((resource, url) => {
      if (typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)) {
        resource.refresh();
      }
    });
  }

  /** Removes the cached read of `url`: `invalidate` skips it, and the next read fetches it anew. */
  function drop(url: string) {
    resources.delete(withLocale(url, getLocale()));
  }

  return {
    getRessource,
    invalidate,
    drop
  };
}

export function setAPIProxyContext(getLocale: () => string | undefined) {
  return setContext(API_PROXY, createAPIProxy(getLocale));
}

export function getAPIProxyContext() {
  return getContext<ReturnType<typeof setAPIProxyContext>>(API_PROXY);
}

export const API_PROXY = Symbol('rime.api-proxy');

export type Resource<T = any> = {
  data: T | null;
  isLoading: boolean;
  error: any;
  url: string;
  refresh: () => void;
};

type GetResourcesOptions<T> = { transformData?: (input: any) => T };
