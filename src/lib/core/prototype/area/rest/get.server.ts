import { readParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `GET /api/<area>`: the area's document, with `depth`, `select`, and `latest`/`versionId` for
 * staff. Answers `{ doc }`.
 */
export const restGet = endpoint(async ({ event, area }) => {
  const doc = await area.find(readParams(event, area.config.asTitle));
  return Response.json({ doc });
});
