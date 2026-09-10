import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { error, json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

export const restDuplicate = endpoint(async ({ event, collection }) => {
  //
  if (!event.params.id) throw error(404);

  const [duplicateError, newId] = await trycatch(() =>
    collection.duplicate({ id: event.params.id! })
  );

  if (duplicateError) {
    return handleError(duplicateError, { context: ERROR_CONTEXT.API });
  }

  return json({ id: newId });
});
