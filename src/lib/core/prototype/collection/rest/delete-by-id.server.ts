import { handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * DELETE handler for the collection API endpoint to delete a document by its ID.
 */
export const restDeleteById = endpoint(async ({ event, collection }) => {
  //
  const id = event.params.id || '';
  const [error] = await trycatch(() => collection.deleteById({ id }));

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ id });
});
