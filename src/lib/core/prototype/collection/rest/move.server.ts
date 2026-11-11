import { RimeError } from '#lib/core/errors/index.js';
import { isNested } from '#lib/core/prototype/collection/nested/enabled.js';
import { moveNested } from '#lib/core/prototype/collection/nested/move.server.js';
import { requestData, writeParams } from '#lib/core/prototype/shared/rest/params.server.js';
import { endpoint } from './endpoint.server.js';

/**
 * `POST /api/<collection>/<id>/move` with `{ parent, order }`, on a nested collection: the page
 * goes under `parent`, `null` for the top, and its new list takes the order of `order`, the ids
 * top to bottom, this page among them. The query names the row the page's update writes, as on a
 * PATCH. Answers `{ doc }`.
 *
 * ```
 * POST /api/pages/c/move { "parent": "p", "order": ["c", "a", "b"] }
 * ```
 */
export const restMove = endpoint(async ({ event, collection }) => {
  const id = event.params.id;
  if (!id) throw new RimeError(RimeError.NOT_FOUND);
  if (!isNested(collection.config)) {
    throw new RimeError(RimeError.BAD_REQUEST, `${collection.config.slug} is not nested`);
  }

  const { parent, order } = await requestData(event);
  if (parent !== null && typeof parent !== 'string') {
    throw new RimeError(RimeError.BAD_REQUEST, 'parent is an id, or null for the top');
  }
  const isIdList =
    Array.isArray(order) && order.every((entry) => typeof entry === 'string') && order.includes(id);
  if (!isIdList) {
    throw new RimeError(
      RimeError.BAD_REQUEST,
      'order is the ids of the new list, this page among them'
    );
  }

  const { versionId, latest } = writeParams(event);
  const doc = await moveNested({ event, collection, id, parent, order, versionId, latest });
  return Response.json({ doc });
});
