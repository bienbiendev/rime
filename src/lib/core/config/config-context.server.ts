import type { AreaSlug, CollectionSlug, Config, PrototypeSlug } from '$lib/types.js';
import { ensureMedias } from '../ensure.server.js';
import { RimeError } from '../errors/index.js';
import type { BuildConfig } from './server/build-config.server.js';

export function createConfigContext<const C extends Config>(config: BuildConfig<C>) {
  //
  ensureMedias(config);

  const mapCollections = Object.fromEntries(
    config.collections.map((c) => [c.slug, c])
  ) as typeof config.$InferCollections;
  const mapCollectionsSlug = config.collections.map((c) => c.slug);

  const mapAreas = Object.fromEntries(
    config.areas.map((a) => [a.slug, a])
  ) as typeof config.$InferAreas;
  const mapAreasSlug = config.areas.map((a) => a.slug);

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

  const isCollection = (slug: string): slug is CollectionSlug =>
    !!mapCollectionsSlug.includes(slug as any);

  const isArea = (slug: string): slug is AreaSlug => !!mapAreasSlug.includes(slug as any);

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
