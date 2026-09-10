import { normalizeQuery } from '$lib/core/pipeline/query.js';
import { selectWithTitle } from '$lib/core/prototype/shared/title/select.js';
import { PARAMS } from '$lib/core/constants.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * GET handler for the collection API endpoint.
 */
export const restGet = endpoint(async ({ event, collection }) => {
  //
  const { rime } = event.locals;
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
    draft: params.get(PARAMS.DRAFT) ? params.get(PARAMS.DRAFT) === 'true' : undefined,
    query,
    select: selectWithTitle(params.get(PARAMS.SELECT), collection.config.asTitle)
  };

  const [error, docs] = await trycatch(() => collection.find(apiParams));

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ docs }, { status: 200 });
});
