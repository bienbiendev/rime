import { endpoint } from './endpoint.server.js';

/**
 * DELETE handler for the collection API endpoint to delete a document by its ID.
 */
export const restDeleteById = endpoint(async ({ event, collection }) => {
  const id = event.params.id || '';
  await collection.deleteById({ id });

  return Response.json({ id });
});
