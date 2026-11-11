import { RimeError } from '#lib/core/errors/index.js';
import { undoOnError } from '#lib/core/pipeline/run.server.js';
import type { GenericDoc, RawDoc } from '#lib/core/prototype/types.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** What `rime.collection(slug)` hands back, as the REST handlers receive it. */
type CollectionApi = ReturnType<App.Locals['rime']['collection']>;

export type MoveArgs = {
  event: RequestEvent;
  collection: CollectionApi;
  /** The page that moves. */
  id: string;
  /** Its new parent, `null` for the top. */
  parent: string | null;
  /** The ids of its new list, top to bottom, the moved page among them. */
  order: string[];
  /** The row the moved page's update writes, as on a PATCH. */
  versionId?: string;
  latest?: boolean;
};

/**
 * Moves a page under `parent`, and stores its new list in `order`.
 *
 * Each page of the list takes its index as `_position`. The moved page is updated as a document:
 * its hooks run, the cycle check and its new address among them. The other pages get their
 * `_position` and nothing else: no `updatedAt`, no `updatedBy`, no hooks, no version. An id of
 * `order` that is not under `parent` is skipped.
 *
 * The caller may update every page whose row is written, or nothing is.
 *
 * ```ts
 * // A, B and C under P, all at 0
 * await moveNested({ event, collection, id: 'c', parent: 'p', order: ['c', 'a', 'b'] });
 * // C 0, A 1, B 2
 * ```
 */
export const moveNested = async (args: MoveArgs): Promise<GenericDoc> => {
  const { event, collection, id, parent, versionId, latest } = args;
  const { config } = collection;
  const pages = event.locals.rime.adapter.collection(config.slug);

  // Refused before anything is read, as a PATCH is: a 404 would tell whether the page exists.
  if (!config.access.update(event.locals.user, { event, id })) {
    throw new RimeError(RimeError.UNAUTHORIZED);
  }

  const stored: RawDoc[] = await pages.findMany({
    query: { where: { id: { in_array: args.order } } },
    select: ['id', '_parent', '_position']
  });
  if (!stored.some((row) => row.id === id)) throw new RimeError(RimeError.NOT_FOUND);

  // The pages already under the new parent, the moved one aside
  const siblings = stored.filter((row) => row.id !== id && (row._parent || null) === parent);
  const inList = new Set([id, ...siblings.map((row) => row.id)]);
  const list = [...new Set(args.order)].filter((rowId) => inList.has(rowId));
  const changed = siblings.filter((row) => row._position !== list.indexOf(row.id));

  for (const row of changed) {
    if (!config.access.update(event.locals.user, { event, id: row.id })) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }
  }

  const setPosition = (rowId: string, position: unknown) =>
    pages.updateWhere({
      query: { where: { id: { equals: rowId } } },
      data: { _position: position }
    });

  const data: Dic = { _parent: parent, _position: list.indexOf(id) };

  /** Whether the moved page's row holds its new place: its update was written. */
  const isPlaced = async () => {
    const [row]: RawDoc[] = await pages.findMany({
      query: { where: { id: { in_array: [id] } } },
      select: ['id', '_parent', '_position']
    });
    return (row?._parent || null) === parent && row?._position === data._position;
  };

  // A failure puts back the siblings written so far, unless the moved page's row was written
  // before it, by an after-update hook that threw: the list then keeps its new order.
  const written: RawDoc[] = [];
  const putBack = async () => {
    if (await isPlaced()) return;
    for (const row of written) {
      await setPosition(row.id, row._position);
    }
  };

  // The siblings first, so the moved page's update hooks see the list as it now is.
  return undoOnError([putBack], async () => {
    for (const row of changed) {
      await setPosition(row.id, list.indexOf(row.id));
      written.push(row);
    }
    return collection.updateById({ id, versionId, latest, data });
  });
};
