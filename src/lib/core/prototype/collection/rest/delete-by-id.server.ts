import { endpoint } from './endpoint.server.js';

/** `DELETE /api/<collection>/<id>`: deletes the document and answers `{ id }`. */
export const restDeleteById = endpoint(async ({ event, collection }) => {
  const id = event.params.id || '';
  await collection.deleteById({ id });

  return Response.json({ id });
});
