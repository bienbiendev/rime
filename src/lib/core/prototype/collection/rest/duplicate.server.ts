import { RimeError } from '#lib/core/errors/index.js';
import { writeParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/** `POST /api/<collection>/<id>/duplicate`: copies the document and answers the copy's id. */
export const restDuplicate = endpoint(async ({ event, collection }) => {
  if (!event.params.id) throw new RimeError(RimeError.NOT_FOUND);

  // `?versionId=` names the row to copy, for staff; without it, the newest real version.
  const { versionId } = writeParams(event);

  const newId = await collection.duplicate({ id: event.params.id, versionId });

  return Response.json({ id: newId });
});
