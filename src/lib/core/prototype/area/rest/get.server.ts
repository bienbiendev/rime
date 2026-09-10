import { PARAMS } from '$lib/core/constants.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { selectWithTitle } from '$lib/core/prototype/shared/title/select.js';
import { trycatch } from '$lib/util/function.js';
import type { Dic } from '$lib/util/types.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * GET handler for the area API endpoint.
 */
export const restGet = endpoint(async ({ event, area }) => {
  //
  const { rime } = event.locals;
  const params = event.url.searchParams;

  // Prepare the parameters for the API call to find the area document
  const apiParams: Dic = {
    locale: rime.getLocale(),
    draft: params.get(PARAMS.DRAFT) ? params.get(PARAMS.DRAFT) === 'true' : undefined,
    versionId: params.get(PARAMS.VERSION_ID) || undefined,
    depth: params.get(PARAMS.DEPTH) ? parseInt(params.get(PARAMS.DEPTH)!) : 0,
    select: selectWithTitle(params.get(PARAMS.SELECT), area.config.asTitle)
  };

  // Call the area API to find the document based on the prepared parameters
  const [error, doc] = await trycatch(() => area.find(apiParams));

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ doc });
});
