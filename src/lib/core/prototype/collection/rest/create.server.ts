import { requestData } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `POST /api/<collection>`: creates a document from the body (JSON or form data), in the locale
 * `?locale=` names. Answers `{ doc }`, as far as the caller may read it.
 */
export const restCreate = endpoint(async ({ event, collection }) => {
  const data = await requestData(event);
  const doc = await collection.create({ data });
  return Response.json({ doc });
});
