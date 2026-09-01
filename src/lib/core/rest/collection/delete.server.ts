import { normalizeQuery } from '$lib/core/operations/query.js';
import { PARAMS } from '$lib/core/constants.js';
import { RimeError } from '$lib/core/errors/index.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';

/**
 * DELETE handler for the collection API endpoint.
 */
export async function restDelete(event: RequestEvent) {
  //
  const { rime } = event.locals;
  const slug = event.params.slug;
  if (!rime.config.isCollection(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
  }

  const params = event.url.searchParams;

  const hasQueryParams = !!params
    .keys()
    .filter((key) => key.startsWith('where'))
    .toArray().length;

  const query = hasQueryParams ? normalizeQuery(event.url.search.substring(1)) : undefined;

  const apiParams = {
    locale: rime.getLocale(),
    sort: params.get(PARAMS.SORT) || undefined,
    depth: params.get(PARAMS.DEPTH) ? parseInt(params.get(PARAMS.DEPTH)!) : 0,
    limit: params.get(PARAMS.LIMIT) ? parseInt(params.get(PARAMS.LIMIT)!) : undefined,
    offset: params.get(PARAMS.OFFSET) ? parseInt(params.get(PARAMS.OFFSET)!) : undefined,
    query,
    select: params.get(PARAMS.SELECT) ? params.get(PARAMS.SELECT)!.split(',') : undefined
  };

  const [error, docs] = await trycatch(() => rime.collection(slug).delete(apiParams));

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ docs }, { status: 200 });
}
