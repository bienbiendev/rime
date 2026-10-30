import type { CollectionApi } from '#lib/core/prototype/collection/api.server.js';
import { trycatch } from '#lib/util/function.js';
import type { Dic } from '#lib/util/types.js';

/**
 * Creates a folder row through `directories`, the folders collection as rime (`.system()`): the
 * folders are the upload's own bookkeeping. A create that fails because another request made the
 * folder meanwhile is no error: the folder is read again, and the failure throws only when it is
 * still missing.
 *
 * ```ts
 * await createDirectory(rime.collection('$mediasDirectories').system(), { id: 'root' });
 * ```
 */
export const createDirectory = async (
  directories: Pick<CollectionApi<any>, 'create' | 'findById'>,
  data: Dic & { id: string }
) => {
  const [createError] = await trycatch(() => directories.create({ data }));
  if (!createError) return;
  const [, createdMeanwhile] = await trycatch(() =>
    directories.findById({ select: ['id'], id: data.id })
  );
  if (!createdMeanwhile) throw createError;
};
