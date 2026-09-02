import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * PATCH handler for the collection API endpoint to update a document by its ID.
 */
export const restUpdateById = endpoint(async ({ event, collection }) => {
  //
  const { rime } = event.locals;
  const id = event.params.id;

  if (!id) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
  }

  // Extract query parameters for versioning and draft status
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

  const [error, document] = await trycatch(() =>
    collection.updateById({
      id,
      data,
      locale: rime.getLocale(),
      versionId,
      draft
    })
  );

  if (error) {
    return handleError(error, { context: ERROR_CONTEXT.API });
  }

  return json({ doc: document });
});
