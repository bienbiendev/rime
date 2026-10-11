import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { trycatchSync } from '#lib/util/function.js';
import { getSegments } from '#lib/core/prototype/collection/upload/util/path.js';

/**
 * Runs before a create or update on a `$<slug>Directories` collection: normalises and validates
 * the path in `id`, then derives `parent` and `name` from it.
 */
export const exctractPath = Hooks.beforeUpsert<'directory'>(async function exctractPath(args) {
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
