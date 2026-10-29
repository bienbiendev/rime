import type {
  BuiltAreaClient,
  BuiltCollectionClient,
  BuiltConfigClient
} from '#lib/core/config/types.js';
import type { Prototype, PrototypeSlug } from '#lib/core/prototype/types.js';
import { getContext, setContext } from 'svelte';

/** The panel's view of the built config: a collection or area found by slug. */
function createConfigStore(config: BuiltConfigClient) {
  function getArea(slug: string): BuiltAreaClient {
    return config.areas.filter((c) => c.slug === slug)[0];
  }

  /** The collection with this slug; `undefined` for an unknown slug, whatever the type says. */
  function getCollection(slug: string): BuiltCollectionClient {
    return config.collections.filter((c) => c.slug === slug)[0];
  }

  function getDocumentConfig(args: { prototype: Prototype; slug: PrototypeSlug }) {
    return args.prototype === 'area' ? getArea(args.slug) : getCollection(args.slug);
  }

  return {
    get raw() {
      return config;
    },
    getCollection,
    getDocumentConfig
  };
}

export const CONFIG_CTX = Symbol('rime.config');

export function setConfigContext(initial: BuiltConfigClient) {
  const store = createConfigStore(initial);
  return setContext(CONFIG_CTX, store);
}

export function getConfigContext() {
  return getContext<ReturnType<typeof setConfigContext>>(CONFIG_CTX);
}
