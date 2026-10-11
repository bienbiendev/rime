import { RimeError } from '#lib/core/errors/index.js';
import { requestData, writeParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * PATCH handler for the collection API endpoint to update a document by its ID.
 */
export const restUpdateById = endpoint(async ({ event, collection }) => {
  const id = event.params.id;
  if (!id) throw new RimeError(RimeError.NOT_FOUND);
  const data = await requestData(event);
  const doc = await collection.updateById({ id, data, ...writeParams(event) });
  return Response.json({ doc });
});
