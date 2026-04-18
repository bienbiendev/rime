import { normalizeQuery } from '$lib/adapter-sqlite/util.js';
import { PARAMS } from '$lib/core/constant.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';

export default function (slug: CollectionSlug) {
  //
  async function DELETE(event: RequestEvent) {
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
      query,
      select: params.get(PARAMS.SELECT) ? params.get(PARAMS.SELECT)!.split(',') : undefined
    };

    const [error, docs] = await trycatch(() => rime.collection(slug).delete(apiParams));

    if (error) {
      return handleError(error, { context: 'api' });
    }

    return json({ docs }, { status: 200 });
  }

  return DELETE;
}
