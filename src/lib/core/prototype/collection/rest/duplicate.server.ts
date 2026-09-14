import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { error, json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

export const restDuplicate = endpoint(async ({ event, collection }) => {
  //
  if (!event.params.id) throw error(404);

  // `?versionId=` names the row to copy; without it, the newest real version.
  const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;

  const [duplicateError, newId] = await trycatch(() =>
    collection.duplicate({ id: event.params.id!, versionId })
  );

  if (duplicateError) {
    return handleError(duplicateError, { context: ERROR_CONTEXT.API });
  }

  return json({ id: newId });
});
