import { requestData, writeParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `PATCH /api/<area>`: updates the area's document from the body, in the locale `?locale=`
 * names. `versionId`, `latest` and `fork` in the query name the row. Answers `{ doc }`.
 */
export const restUpdate = endpoint(async ({ event, area }) => {
  const data = await requestData(event);
  const doc = await area.update({ data, ...writeParams(event) });
  return Response.json({ doc });
});
