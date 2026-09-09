import type { Dic } from '$lib/util/types.js';
import type { FeatureDefinition } from '$lib/core/features/define.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { BuiltPrototype, PrototypeApiContext } from './define.js';
import type { GenericDoc } from './types.js';
import { blankWithFeatures, readQueryOf } from '../features/fold.js';
import { createBlankDocument } from './doc.js';

/**
 * The two pieces a prototype's local API is composed from. **Not a base it is fitted into.**
 *
 * This used to be `buildPrototypeApi({ definition, … })`: core assembled the API, called back
 * into `definition.api(ctx)` for the middle of it, and appended `blank` and `system` on the
 * prototype's behalf. So `rime.collection('pages')` was three files deep and no file said what
 * the object actually had on it — `collection/api.server.ts` listed the verbs and then a comment
 * explaining which members were somebody else's.
 *
 * Now each prototype states its whole surface in its own `api.server.ts` and reaches for these
 * two when it wants them. Nothing here knows a prototype has a `blank`, or a `find`, or anything.
 */

/** What building a prototype's API for one request needs. */
export type PrototypeApiArgs<C extends BuiltPrototype> = {
  config: C;
  /** The features extending this prototype — the definition's own list, passed by the caller. */
  features: FeatureDefinition[];
  event: RequestEvent;
  defaultLocale: string | undefined;
};

/**
 * Adds `.system()` to an API: the same API over an escalated context.
 *
 * A combinator rather than a member a prototype could write itself, because a system call has to
 * *re-enter* the builder — it is the same API over a different context, not a mutable flag on a
 * shared object. `system(false)` hands back the API it was called on, which is what lets
 * `system(someBoolean)` read as "escalate if needed".
 */
export const withSystem = <C extends BuiltPrototype, A extends Dic>(
  args: PrototypeApiArgs<C>,
  build: (ctx: PrototypeApiContext<C>) => A
): A & { system(isSystem?: boolean): A } => {
  const make = (isSystemOperation: boolean) => {
    const api = build(prototypeContext({ ...args, isSystemOperation })) as A & {
      system(isSystem?: boolean): A;
    };
    api.system = (isSystem: boolean = true) => (isSystem ? make(true) : api);
    return api;
  };

  return make(false);
};

/**
 * The per-call plumbing a prototype's operations are handed — the locale fallback, the blank
 * document, the content query, the cache wrapper.
 *
 * Per-call, not per-process: `isSystemOperation` is part of it, so `.system()` is a second
 * context rather than a flag anybody has to remember to forward.
 */
export const prototypeContext = <C extends BuiltPrototype>(
  args: PrototypeApiArgs<C> & { isSystemOperation: boolean }
): PrototypeApiContext<C> => {
  const { config, features, event, defaultLocale, isSystemOperation } = args;

  return {
    config,
    event,
    defaultLocale,
    isSystemOperation,
    features,

    fallbackLocale: (locale?: string) => locale || event.locals.locale || defaultLocale,

    contentQuery: (params, intent = 'read') => readQueryOf(features, config, params, intent),

    /**
     * A blank document of this config's shape, after the features it enables have shaped it.
     *
     * The auth case used to be written out here, behind an `isAuthConfig` test and a comment
     * saying it belonged to the feature — it does now, through `FeatureDefinition.blank`, and
     * nothing here names a feature or asks what a config declares.
     */
    blank: () =>
      blankWithFeatures(features, createBlankDocument(config, event), config) as GenericDoc,

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
