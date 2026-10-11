import { RimeError } from '#lib/core/errors/index.js';
import { listParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `DELETE /api/<collection>?where[…]`: deletes the documents the filter matches, each through
 * the delete access and hooks, and answers their ids. A request with no `where` answers 400: a
 * bulk delete always names what it deletes.
 */
export const restDelete = endpoint(async ({ event, collection }) => {
  const { query, sort, limit, offset } = listParams(event);
  if (!query) {
    throw new RimeError(RimeError.BAD_REQUEST, 'a delete on the list names a where filter');
  }

  const docs = await collection.delete({ query, sort, limit, offset });

  return Response.json({ docs }, { status: 200 });
});
