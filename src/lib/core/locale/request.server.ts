import type { ConfigContext } from '#lib/core/config/context.server.js';
import { PARAMS } from '#lib/core/constants.js';
import { createRoutesContext } from '#lib/core/routes/context.server.js';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * The first code the config lists, else the default locale (`undefined` without localization).
 *
 * ```ts
 * // locales fr (default), en
 * knownLocale(config, 'zz', 'en'); // 'en'
 * knownLocale(config, 'zz'); // 'fr'
 * ```
 */
export const knownLocale = (config: ConfigContext, ...codes: unknown[]) =>
  codes.find((code): code is string => typeof code === 'string' && config.isValidLocale(code)) ??
  config.getDefaultLocale();

/**
 * The codes a request names, first choice first, where its surface keeps them. The site never
 * reads the `rime.locale` cookie: it holds the editor's locale, not the visitor's.
 *
 * ```ts
 * // /api/pages?locale=en              → ['en']         the query string only
 * // /panel/pages?locale=en, cookie fr → ['en', 'fr']   the query string, then the panel cookie
 * // /en/about-us                      → ['en']         the route param `locale` only
 * ```
 */
const askedLocales = (event: RequestEvent): unknown[] => {
  const routes = createRoutesContext(event);
  const query = event.url.searchParams.get(PARAMS.LOCALE);
  if (routes.isAPI) return [query];
  if (routes.isPanel) return [query, event.cookies.get('rime.locale')];
  return ['locale' in event.params ? event.params.locale : undefined];
};

/** The locale a request runs in: the first configured code its surface names, else the default. */
export const requestLocale = (event: RequestEvent, config: ConfigContext) =>
  knownLocale(config, ...askedLocales(event));
