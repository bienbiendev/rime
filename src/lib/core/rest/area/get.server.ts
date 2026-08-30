import { PARAMS } from '$lib/core/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import type { Dic } from '$lib/util/types.js';
import { json, type RequestEvent } from '@sveltejs/kit';

/**
 * GET handler for the area API endpoint.
 */
export async function restGet(event: RequestEvent) {
  //
  const { rime } = event.locals;

  // Check if the slug corresponds to a valid area
  const slug = event.params.slug;
  if (!rime.config.isArea(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
  }

  const params = event.url.searchParams;
  const areaAPI = rime.area(slug);

  // Build the select parameter for the API call based on the request parameters
  function buildSelect(params: typeof event.url.searchParams) {
    const paramSelect = params.get(PARAMS.SELECT)
      ? params.get(PARAMS.SELECT)!.split(',')
      : undefined;
    if (
      paramSelect &&
      paramSelect.includes('title') &&
      !paramSelect.includes(areaAPI.config.asTitle)
    ) {
      paramSelect.push(areaAPI.config.asTitle);
    }
    return paramSelect;
  }

  // Prepare the parameters for the API call to find the area document
  const apiParams: Dic = {
    locale: rime.getLocale(),
    draft: params.get(PARAMS.DRAFT) ? params.get(PARAMS.DRAFT) === 'true' : undefined,
    versionId: params.get(PARAMS.VERSION_ID) || undefined,
    depth: params.get(PARAMS.DEPTH) ? parseInt(params.get(PARAMS.DEPTH)!) : 0,
    select: buildSelect(params)
  };

  // Call the area API to find the document based on the prepared parameters
  const [error, doc] = await trycatch(() => rime.area(slug).find(apiParams));

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ doc });
}
