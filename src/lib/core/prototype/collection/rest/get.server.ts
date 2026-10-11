import { listParams, readParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * GET handler for the collection API endpoint.
 */
export const restGet = endpoint(async ({ event, collection }) => {
  // A list reads no `versionId`: each document answers its own row
  const { latest, depth, select } = readParams(event, collection.config.asTitle);
  const docs = await collection.find({ ...listParams(event), latest, depth, select });

  return Response.json({ docs }, { status: 200 });
});
