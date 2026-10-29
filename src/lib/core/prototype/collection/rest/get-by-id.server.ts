import { RimeError } from '#lib/core/errors/index.js';
import { readParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `GET /api/<collection>/<id>`: one document, with `depth`, `select`, and `latest`/`versionId`
 * for staff. Answers `{ doc }`.
 */
export const restGetById = endpoint(async ({ event, collection }) => {
  const id = event.params.id;
  if (!id) throw new RimeError(RimeError.NOT_FOUND);
  const doc = await collection.findById({ id, ...readParams(event, collection.config.asTitle) });
  return Response.json({ doc });
});
