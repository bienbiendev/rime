import type { AreaSlug, CollectionSlug, Config, PrototypeSlug } from '$lib/types.js';
import { RimeError } from '../errors/index.js';
import type { BuildConfig } from './build.server.js';
import { shadowOf } from '../features/registry.js';
import { area, collection } from '$lib/core/prototype/index.js';

/**
 * What `event.locals.rime.config` is.
 *
 * Declared here, beside the function it is derived from, so that naming this type does not mean
 * importing rime.server.js: `createAuthInstance` needs the name, and reaching for it there closes
 * a `rime.server → boot.server → instance.server` cycle.
 */
export type ConfigContext<C extends Config = Config> = ReturnType<typeof createConfigContext<C>>;

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

  /** Every built prototype config, whatever its kind. */
  const allPrototypes = [...config.collections, ...config.areas];

  /**
   * Where each config's content lives, when a feature gives it a second table.
   *
   * Folded once, from the features that extend each prototype — the same question `boot` asks
   * before handing the answer to `registerPrototype`, and the schema generator before building the
   * table. This exists so that code holding a `ConfigContext` but no registry can ask it too: the
   * adapter's transform and url writers both did `config.versions ? withVersionsSuffix(slug) : slug`,
   * which is the database layer naming a feature and its table.
   *
   * A `Map` rather than a lookup per call: the transform runs on every document of every read.
   */
  const shadowSlugs = new Map<string, string>(
    [
      ...config.collections.map((c) => [collection.features, c] as const),
      ...config.areas.map((a) => [area.features, a] as const)
    ].flatMap(([features, prototypeConfig]) => {
      const shadow = shadowOf(features, prototypeConfig);
      return shadow ? [[prototypeConfig.slug, shadow.slug] as [string, string]] : [];
    })
  );

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
     * Gets every built prototype config, whatever its kind
     */
    get prototypes() {
      return allPrototypes;
    },

    /**
     * The slug a config's content lives under, or `undefined` when it lives on the config's own
     * row. `shadowSlugOf(slug) ?? slug` is "the table this config's content is in".
     */
    shadowSlugOf: (slug: string): PrototypeSlug | undefined =>
      shadowSlugs.get(slug) as PrototypeSlug | undefined,

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
