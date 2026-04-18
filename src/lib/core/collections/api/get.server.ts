import { normalizeQuery } from '$lib/adapter-sqlite/util.js';
import { PARAMS } from '$lib/core/constant.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';

export default function (slug: CollectionSlug) {
  //
  async function GET(event: RequestEvent) {
    const { rime } = event.locals;
    const params = event.url.searchParams;

    const hasQueryParams = !!params
      .keys()
      .filter((key) => key.startsWith('where'))
      .toArray().length;

    const collectionAPI = rime.collection(slug);

    function buildSelect(params: typeof event.url.searchParams) {
      const paramSelect = params.get(PARAMS.SELECT)
        ? params.get(PARAMS.SELECT)!.split(',')
        : undefined;
      if (
        paramSelect &&
        paramSelect.includes('title') &&
        !paramSelect.includes(collectionAPI.config.asTitle)
      ) {
        paramSelect.push(collectionAPI.config.asTitle);
      }
      return paramSelect;
    }

    const query = hasQueryParams ? normalizeQuery(event.url.search.substring(1)) : undefined;
    const apiParams = {
      locale: rime.getLocale(),
      sort: params.get(PARAMS.SORT) || undefined,
      depth: params.get(PARAMS.DEPTH) ? parseInt(params.get(PARAMS.DEPTH)!) : 0,
      limit: params.get(PARAMS.LIMIT) ? parseInt(params.get(PARAMS.LIMIT)!) : undefined,
      offset: params.get(PARAMS.OFFSET) ? parseInt(params.get(PARAMS.OFFSET)!) : undefined,
      draft: params.get(PARAMS.DRAFT) ? params.get(PARAMS.DRAFT) === 'true' : undefined,
      query,
      select: buildSelect(params)
    };

    const [error, docs] = await trycatch(() => collectionAPI.find(apiParams));

    if (error) {
      return handleError(error, { context: 'api' });
    }

    return json({ docs }, { status: 200 });
  }

  return GET;
}
