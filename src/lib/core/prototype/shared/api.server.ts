import type { Dic } from '#lib/util/types.js';
import type { PrototypeApiContext } from '../define.js';

/** The locale to act in: the one asked for, else the request's, else the config's default. */
export const fallbackLocale = (api: PrototypeApiContext, locale?: string) =>
  locale || api.event.locals.locale || api.defaultLocale;

/**
 * A read through the API cache, when the cache is on and rime is not the caller.
 *
 * ```ts
 * cachedRead(this, 'area.find', { locale, depth }, () => find({ ctx: this, locale, depth }));
 * ```
 */
export const cachedRead = <T>(
  api: PrototypeApiContext,
  operation: string,
  key: Dic,
  read: () => Promise<T>
): Promise<T> => {
  const { event, config, isSystemOperation } = api;
  if (!event.locals.cacheEnabled || isSystemOperation) return read();

  // Who is asking, by id: an api key's user has no email
  const cacheKey = event.locals.rime.cache.createKey(operation, {
    slug: config.slug,
    userId: event.locals.user?.id,
    userRoles: event.locals.user?.roles,
    ...key
  });
  return event.locals.rime.cache.get(cacheKey, read);
};
