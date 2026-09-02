import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * PATCH handler for the area API endpoint.
 */
export const restUpdate = endpoint(async ({ event, area }) => {
  //
  const { rime } = event.locals;

  // Extract versionId and draft parameters from the request URL
  const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const draft = event.url.searchParams.get(PARAMS.DRAFT)
    ? event.url.searchParams.get(PARAMS.DRAFT) === 'true'
    : undefined;

  // Extract data from the request body
  const [extractError, data] = await trycatch(() => extractData(event.request));
  if (extractError) {
    return handleError(extractError, { context: ERROR_CONTEXT.API });
  }

  // Set the locale if provided in the data
  if (data.locale) {
    rime.setLocale(data.locale);
  }

  // Update the area with the extracted data, versionId, draft status, and current locale
  const [error, doc] = await trycatch(() =>
    area.update({
      data,
      versionId,
      draft,
      locale: rime.getLocale()
    })
  );

  if (error) {
    return handleError(error, { context: ERROR_CONTEXT.API });
  }

  return json({ doc });
});
