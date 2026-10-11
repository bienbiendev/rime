import type { ResolvedPathname } from '$app/types';
import { PARAMS } from '#lib/core/constants.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { panelPath } from '#lib/core/routes/util.js';

/**
 * The create page of a collection. An upload collection opens it in a folder, the root when none
 * is given.
 *
 * ```ts
 * createPath({ kebab: 'pages' }); // /panel/pages/create
 * createPath({ kebab: 'medias', upload: {} }, 'root:a'); // /panel/medias/create?uploadPath=root:a
 * ```
 */
export const createPath = (
  config: { kebab: string; upload?: unknown },
  folder?: string | null
): ResolvedPathname => {
  const path = panelPath(config.kebab, 'create');
  if (!config.upload) return path;
  return `${path}?${PARAMS.UPLOAD_PATH}=${folder || UPLOAD_PATH.ROOT_NAME}` as ResolvedPathname;
};

/**
 * The path segments of a document: its kebab and id for a collection document, its kebab alone
 * for an area. Each caller builds its own URL from them.
 *
 * ```ts
 * documentSegments('pages', { _prototype: 'collection', id: 'a1' }); // ['pages', 'a1']
 * documentSegments('settings', { _prototype: 'area' }); // ['settings']
 * ```
 */
export const documentSegments = (kebab: string, doc: { _prototype?: string; id?: string }) =>
  doc._prototype === 'collection' && doc.id ? [kebab, doc.id] : [kebab];

/**
 * The url with `?locale=code`, unless it names a locale already or there is no code. The rest of
 * the url is kept as written.
 *
 * ```ts
 * withLocale('/api/pages?limit=5', 'fr'); // '/api/pages?limit=5&locale=fr'
 * withLocale('/api/pages?locale=en', 'fr'); // '/api/pages?locale=en'
 * withLocale('/api/pages', undefined); // '/api/pages'
 * ```
 */
export const withLocale = (url: string, code: string | undefined) => {
  const search = url.split('?')[1] ?? '';
  if (!code || new URLSearchParams(search).has(PARAMS.LOCALE)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${PARAMS.LOCALE}=${code}`;
};
