import { getContext, setContext } from 'svelte';

function createAPIProxy() {
  const resources = $state<Map<string, Resource>>(new Map());

  function getRessource<T>(url: string, options?: GetResourcesOptions<T>) {
    // Check if we already have this resource
    if (!resources.has(url)) {
      // Create a new resource
      const resource = createResource<T>(url, options);
      resources.set(url, resource);
    }
    return resources.get(url) as Resource<T>;
  }

  function createResource<T>(url: string, options?: GetResourcesOptions<T>): Resource<T> {
    // Use $state for the resource data to make it reactive
    let data = $state<T | null>(null);
    let isLoading = $state(true);
    let error = $state(null);

    // Fetch the data immediately
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

  function invalidateAll() {
    resources.forEach((resource) => {
      resource.refresh();
    });
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
    invalidateAll,
    invalidate,
    get urls() {
      return Array.from(resources.entries()).map(([url]) => url);
    }
  };
}

export function setAPIProxyContext(key = API_PROXY.ROOT) {
  const apiProxy = createAPIProxy();
  return setContext(key, apiProxy);
}

export function getAPIProxyContext(key = API_PROXY.ROOT) {
  return getContext<ReturnType<typeof setAPIProxyContext>>(key);
}

export const API_PROXY = {
  ROOT: Symbol('api-proxy.root')
};

export type Resource<T = any> = {
  data: T | null;
  isLoading: boolean;
  error: any;
  url: string;
  refresh: () => void;
};

type GetResourcesOptions<T> = { transformData?: (input: any) => T };
