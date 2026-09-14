import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { extractData } from '$lib/core/pipeline/extract-data.server.js';
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

  // Which row: `versionId`, else the newest with `latest`, else the published one. `fork` makes
  // a new version from it instead of writing it.
  const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const latest = event.url.searchParams.get(PARAMS.LATEST) === 'true' || undefined;
  const fork = event.url.searchParams.get(PARAMS.FORK) === 'true' || undefined;

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
      latest,
      fork
    })
  );

  if (error) {
    return handleError(error, { context: ERROR_CONTEXT.API });
  }

  return json({ doc: document });
});
