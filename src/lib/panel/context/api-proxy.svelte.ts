import { withLocale } from '#lib/panel/util/url.js';
import { getContext, setContext } from 'svelte';

/**
 * `getLocale` answers the panel's locale, which every resource names: the resource is keyed by
 * its url with that locale, so after a switch the same url is a new resource.
 */
function createAPIProxy(getLocale: () => string | undefined) {
  const resources = $state<Map<string, Resource>>(new Map());

  function getRessource<T>(url: string, options?: GetResourcesOptions<T>) {
    const target = withLocale(url, getLocale());
    if (!resources.has(target)) {
      resources.set(target, createResource<T>(target, options));
    }
    return resources.get(target) as Resource<T>;
  }

  function createResource<T>(url: string, options?: GetResourcesOptions<T>): Resource<T> {
    // Use $state for the resource data to make it reactive
    let data = $state<T | null>(null);
    let isLoading = $state(true);
    let error = $state(null);

    fetchData();

    function fetchData() {
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
          data = options?.transformData ? options?.transformData(json) : json;
          isLoading = false;
        })
        .catch((err) => {
          error = err;
          isLoading = false;
          console.error(`Error fetching ${url}:`, err);
        });
    }

    // The resource object with reactive properties
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

  function invalidate(pattern: string | RegExp) {
    resources.forEach((resource, url) => {
      if (typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)) {
        resource.refresh();
      }
    });
  }

  return {
    getRessource,
    invalidate
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
