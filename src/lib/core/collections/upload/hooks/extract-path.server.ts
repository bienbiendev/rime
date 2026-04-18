import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { trycatchSync } from '$lib/util/function.js';
import { getSegments } from '../util/path.js';

/**
 * Hook executed before save/update operations on {uploadSlug}_directories collections
 * the function nomalize and validate path ({slug}_directories.id).
 * Then extract parent, name from the given path.
 */
export const exctractPath = Hooks.beforeUpsert<'directory'>(async (args) => {
  let data = args.data;

  if (data?.id) {
    const [error, segments] = trycatchSync(() => getSegments(data.id));
    if (error) {
      throw new RimeError(RimeError.INVALID_DATA, error.message);
    }
    data = {
      ...data,
      id: segments.path,
      name: segments.name,
      parent: segments.parent
    };
  }

  return { ...args, data };
});
