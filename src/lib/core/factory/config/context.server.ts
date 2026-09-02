import type { AreaSlug, CollectionSlug, Config, PrototypeSlug } from '$lib/types.js';
import { RimeError } from '../../errors/index.js';
import type { BuildConfig } from './build.server.js';

/**
 * Object passed to the locals.rime to access the configuration in the server context
 * it is created once on server start and can be used in any server context (load, actions, hooks, etc) via `event.locals.rime.config`
 *
 * @example
 * ```ts
 * // In +page.server.ts
 * const config = event.locals.rime.config.raw;
 * ```
 */
export function createConfigContext<const C extends Config>(config: BuildConfig<C>) {
  const mapCollections = Object.fromEntries(
    config.collections.map((c) => [c.slug, c])
  ) as typeof config.$InferCollections;
  const mapCollectionsSlug = config.collections.map((c) => c.slug);

  const mapAreas = Object.fromEntries(
    config.areas.map((a) => [a.slug, a])
  ) as typeof config.$InferAreas;
  const mapAreasSlug = config.areas.map((a) => a.slug);

  /**
   * Every built config of one prototype kind, by the name it is registered under.
   *
   * The registry-driven counterpart to `.collections` / `.areas`: code that iterates prototypes
   * asks for a name it got from the registry rather than picking one of two hardcoded accessors,
   * so a third kind costs nothing here.
   */
  /**
   * Every built prototype config, whatever its kind.
   *
   * The one place left that still says `collections` and `areas` by name. It survives because
   * the config *factory* is still two builders (`factory/collection/`, `factory/area/`) — the
   * doc retires those through `defineFeature({ augment })`, and this spread goes with them.
   * Everything downstream asks by prototype name instead, so a third kind costs one entry here
   * and nothing else.
   */
  const allPrototypes = [...config.collections, ...config.areas];

  const byPrototype = (name: string) =>
    allPrototypes.filter((prototype) => prototype.type === name);

  /**
   * One config, named by prototype and slug.
   *
   * What `rime.<name>(slug)` looks up. It asks for both halves on purpose: `getBySlug` would
   * find an area for `rime.collection('settings')` and hand back an API that cannot work on it.
   */
  const getByPrototype = (name: string, slug: string) => {
    const found = byPrototype(name).find((prototype) => prototype.slug === slug);
    if (!found) throw new RimeError(RimeError.BAD_REQUEST, `${slug} is not a ${name}`);
    return found;
  };

  const getLocalesCodes = () =>
    config.localization ? config.localization.locales.map((l) => l.code) : [];

  const isValidLocale = (locale: string) => getLocalesCodes().includes(locale);

  const getArea = (slug: string) => {
    const areaConfig = (config.areas || []).find((g) => g.slug === slug);
    if (!areaConfig) throw new RimeError(RimeError.BAD_REQUEST, `${slug} is not an area`);
    return areaConfig;
  };

  const getCollection = (slug: string) => {
    const collectionConfig = (config.collections || []).find((c) => c.slug === slug);
    if (!collectionConfig)
      throw new RimeError(RimeError.BAD_REQUEST, `${slug} is not a collection`);
    return collectionConfig;
  };

  const getBySlug = (slug: string) => {
    try {
      return getCollection(slug);
    } catch {
      try {
        return getArea(slug);
      } catch {
        throw new RimeError(RimeError.BAD_REQUEST, `${slug} is not a valid area or collection`);
      }
    }
  };

  const isCollection = (slug?: string): slug is CollectionSlug =>
    !!mapCollectionsSlug.includes(slug as any);

  const isArea = (slug?: string): slug is AreaSlug => !!mapAreasSlug.includes(slug as any);

  return {
    /**
     * Gets raw config object
     */
    get raw() {
      return config;
    },

    /**
     * Gets all collections config
     */
    get collections() {
      return mapCollections;
    },

    /**
     * Gets all areas config
     */
    get areas() {
      return mapAreas;
    },

    /**
     * Gets every config of one prototype kind, by registry name
     */
    /**
     * Gets every built prototype config, whatever its kind
     */
    get prototypes() {
      return allPrototypes;
    },

    byPrototype,

    /**
     * Gets one config by prototype name and slug
     */
    getByPrototype,

    /**
     * Gets the default locale from the configuration
     */
    getDefaultLocale() {
      return config.localization?.default || undefined;
    },

    /**
     * Gets all configured locale codes
     */
    getLocalesCodes,

    /**
     * Checks if a locale code is valid according to the configuration
     */
    isValidLocale,

    /**
     * Retrieves an area configuration by its slug
     */
    getArea,

    /**
     * Retrieves a collection configuration by its slug
     */
    getCollection,

    /**
     * Retrieves either an area or collection configuration by its slug
     */
    getBySlug,

    /**
     * Checks if a slug represents a collection
     */
    isCollection,

    /**
     * Checks if a slug represents an area
     */
    isArea,

    /**
     * Determines the prototype (collection or area) of a document by its slug
     */
    getDocumentPrototype(slug: PrototypeSlug) {
      if (isCollection(slug)) return 'collection';
      if (isArea(slug)) return 'area';
      throw new RimeError(RimeError.BAD_REQUEST, slug + ' is neither a collection nor an area');
    }
  };
}
