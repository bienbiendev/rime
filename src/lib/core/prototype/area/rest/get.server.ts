import { readParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * GET handler for the area API endpoint.
 */
export const restGet = endpoint(async ({ event, area }) => {
  const doc = await area.find(readParams(event, area.config.asTitle));
  return Response.json({ doc });
});
