import { requestData } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * POST handler for the collection API endpoint.
 */
export const restCreate = endpoint(async ({ event, collection }) => {
  const data = await requestData(event);
  const doc = await collection.create({ data });
  return Response.json({ doc });
});
