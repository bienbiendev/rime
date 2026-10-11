import { RimeError } from '#lib/core/errors/index.js';
import { readParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * GET handler for the collection API endpoint to retrieve a document by its ID.
 */
export const restGetById = endpoint(async ({ event, collection }) => {
  const id = event.params.id;
  if (!id) throw new RimeError(RimeError.NOT_FOUND);
  const doc = await collection.findById({ id, ...readParams(event, collection.config.asTitle) });
  return Response.json({ doc });
});
