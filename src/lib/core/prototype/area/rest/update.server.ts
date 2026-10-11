import { requestData, writeParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * PATCH handler for the area API endpoint.
 */
export const restUpdate = endpoint(async ({ event, area }) => {
  const data = await requestData(event);
  const doc = await area.update({ data, ...writeParams(event) });
  return Response.json({ doc });
});
