import { RimeError } from '#lib/core/errors/index.js';
import { requestData, writeParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `PATCH /api/<collection>/<id>`: updates a document from the body, in the locale `?locale=`
 * names. The query names the row: `versionId`, else the newest with `latest`, else the published
 * one; `fork` makes a new version from it. Answers `{ doc }`.
 */
export const restUpdateById = endpoint(async ({ event, collection }) => {
  const id = event.params.id;
  if (!id) throw new RimeError(RimeError.NOT_FOUND);
  const data = await requestData(event);
  const doc = await collection.updateById({ id, data, ...writeParams(event) });
  return Response.json({ doc });
});
