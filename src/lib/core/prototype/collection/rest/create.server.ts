import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * POST handler for the collection API endpoint.
 */
export const restCreate = endpoint(async ({ event, collection }) => {
  //
  const { rime } = event.locals;

  // Extract data from the request body
  const [extractError, data] = await trycatch(() => extractData(event.request));
  if (extractError) {
    return handleError(extractError, { context: ERROR_CONTEXT.API });
  }

  // Set the locale if provided in the data
  if (data.locale) {
    rime.setLocale(data.locale);
  }

  const [error, document] = await trycatch(() =>
    collection.create({ data, locale: rime.getLocale() })
  );

  if (error) {
    return handleError(error, { context: ERROR_CONTEXT.API });
  }

  return json({ doc: document });
});
