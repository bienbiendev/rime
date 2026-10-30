import { listParams, readParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `GET /api/<collection>/count`: how many documents `GET /api/<collection>` lists for the same
 * `where…` and, for staff, `latest`. Answers `{ count }`.
 */
export const restCount = endpoint(async ({ event, collection }) => {
  const { query } = listParams(event);
  const { latest } = readParams(event, collection.config.asTitle);
  const count = await collection.count({ query, latest });

  return Response.json({ count }, { status: 200 });
});
