import { isStaff } from '#lib/core/auth/access.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError } from '#lib/core/errors/index.js';
import { extractData } from '#lib/core/pipeline/extract-data.server.js';
import { normalizeQuery } from '#lib/core/pipeline/query.js';
import { selectWithTitle } from '#lib/core/prototype/shared/title/select.js';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * What a GET asks for. A row other than the published one is staff's to see: from anyone else,
 * `latest` and `versionId` read as absent. A missing, negative or unreadable `depth` is 0; a
 * deeper one than `MAX_DEPTH` resolves `MAX_DEPTH` levels, as every read does. The locale is the
 * request's, which `?locale=` names.
 *
 * ```ts
 * // ?depth=2&latest=true from staff
 * { latest: true, versionId: undefined, depth: 2, select: undefined }
 * ```
 */
export const readParams = (event: RequestEvent, asTitle: string) => {
  const params = event.url.searchParams;
  const staff = isStaff(event.locals.user);
  const latest = params.get(PARAMS.LATEST);
  return {
    latest: staff && latest ? latest === 'true' : undefined,
    versionId: staff ? params.get(PARAMS.VERSION_ID) || undefined : undefined,
    depth: Math.max(parseInt(params.get(PARAMS.DEPTH) ?? '') || 0, 0),
    select: selectWithTitle(params.get(PARAMS.SELECT), asTitle)
  };
};

/** A whole-number query parameter from `min` up, `undefined` when absent. Anything else answers 400. */
const intParam = (params: URLSearchParams, name: string, min: number) => {
  const raw = params.get(name);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new RimeError(RimeError.BAD_REQUEST, `${name} is a whole number from ${min}`);
  }
  return value;
};

/**
 * What a list request asks for besides `readParams`: its `where` filter, sort, limit and offset.
 *
 * ```ts
 * // ?where[title][equals]=Home&limit=10
 * { query: { where: { title: { equals: 'Home' } } }, sort: undefined, limit: 10, offset: undefined }
 * // ?limit=abc or ?limit=0 -> 400
 * ```
 */
export const listParams = (event: RequestEvent) => {
  const params = event.url.searchParams;
  const hasWhere = [...params.keys()].some((key) => key.startsWith('where'));
  return {
    query: hasWhere ? normalizeQuery(event.url.search.substring(1)) : undefined,
    sort: params.get(PARAMS.SORT) || undefined,
    limit: intParam(params, PARAMS.LIMIT, 1),
    offset: intParam(params, PARAMS.OFFSET, 0)
  };
};

/**
 * Which row a write targets: `versionId`, else the newest with `latest`, else the published
 * one. As on a GET, the first two are staff's to name. `fork` makes a new version from the row
 * instead of writing it.
 */
export const writeParams = (event: RequestEvent) => {
  const params = event.url.searchParams;
  const staff = isStaff(event.locals.user);
  return {
    versionId: staff ? params.get(PARAMS.VERSION_ID) || undefined : undefined,
    latest: (staff && params.get(PARAMS.LATEST) === 'true') || undefined,
    fork: params.get(PARAMS.FORK) === 'true' || undefined
  };
};

/**
 * The request body. A `locale` in it answers 400: `?locale=` names the locale.
 *
 * ```ts
 * PATCH /api/pages/1?locale=fr { title: 'À propos' }               // writes fr
 * PATCH /api/pages/1           { locale: 'fr', title: 'À propos' } // 400
 * ```
 */
export const requestData = async (event: RequestEvent) => {
  const data = await extractData(event.request);
  if ('locale' in data) {
    throw new RimeError(RimeError.BAD_REQUEST, 'name the locale with ?locale=, not in the body');
  }
  return data;
};
