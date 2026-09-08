import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { BuiltPrototype, PrototypeApiContext, PrototypeDefinition } from './define.js';
import type { GenericDoc } from './types.js';
import { blankWithFeatures, readQueryOf } from '../features/registry.js';
import { createBlankDocument } from './doc.js';

/**
 * The plumbing every prototype's local API needs, written once.
 *
 * `CollectionAPI` and `AreaAPI` were two classes with the same private half — the same locale
 * fallback, the same blank document, the same `system()` clone, and the same cache wrapper
 * spelled out at each cached read. None of that is about being a collection or an area, so none
 * of it belongs to either; a definition should only have to say what it lets a caller *do*.
 */

type BuildArgs<C extends BuiltPrototype> = {
  definition: PrototypeDefinition<C, unknown>;
  config: C;
  event: RequestEvent;
  defaultLocale: string | undefined;
};

/**
 * Builds a prototype's local API for one request.
 *
 * `system()` is here rather than in a definition because it has to re-enter this builder: a
 * system call is the same API over a different context, not a mutable flag on a shared object.
 */
export const buildPrototypeApi = <C extends BuiltPrototype>(args: BuildArgs<C>): Dic => {
  const build = (isSystemOperation: boolean): Dic => {
    const ctx = createPrototypeApiContext({ ...args, isSystemOperation });

    const api: Dic = {
      config: ctx.config,
      ...args.definition.api?.(ctx),
      blank: ctx.blank
    };

    // Matching the classes: escalating always builds a fresh API, and `system(false)` returns
    // this one — so it never demotes a system API that a caller passed a computed flag to.
    api.system = (isSystem: boolean = true) => (isSystem ? build(true) : api);

    return api;
  };

  return build(false);
};

const createPrototypeApiContext = <C extends BuiltPrototype>(
  args: BuildArgs<C> & { isSystemOperation: boolean }
): PrototypeApiContext<C> => {
  const { definition, config, event, defaultLocale, isSystemOperation } = args;

  return {
    config,
    event,
    defaultLocale,
    isSystemOperation,

    fallbackLocale: (locale?: string) => locale || event.locals.locale || defaultLocale,

    features: definition.features,

    contentQuery: (params, intent = 'read') =>
      readQueryOf(definition.features, config, params, intent),

    /**
     * A blank document of this config's shape, after the features it enables have shaped it.
     *
     * The auth case used to be written out here, behind an `isAuthConfig` test and a comment
     * saying it belonged to the feature — it does now, through `FeatureDefinition.blank`, and
     * nothing here names a feature or asks what a config declares.
     */
    blank: () =>
      blankWithFeatures(
        definition.features,
        createBlankDocument(config, event),
        config
      ) as GenericDoc,

    cached: <T>(operation: string, key: Dic, read: () => Promise<T>): Promise<T> => {
      if (!event.locals.cacheEnabled || isSystemOperation) return read();

      const cacheKey = event.locals.rime.cache.createKey(operation, {
        slug: config.slug,
        userEmail: event.locals.user?.email,
        userRoles: event.locals.user?.roles,
        ...key
      });

      return event.locals.rime.cache.get(cacheKey, read);
    }
  };
};
