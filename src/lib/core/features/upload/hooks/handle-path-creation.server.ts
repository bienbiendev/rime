import { UPLOAD_PATH } from '$lib/core/constants.js';
import { logger } from '$lib/core/logger.server.js';
import { withDirectoriesSuffix } from '$lib/core/features/upload/naming.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';
import { trycatch } from '$lib/util/function.js';
import { getSegments } from '../util/path.js';

/**
 * Hook executed before save/update operations on an upload collections
 * the function get the document _path and check if it exists,
 * if it doesn't it create {upload_slug}_directories entries recursively
 */
export const handlePathCreation = Hooks.beforeUpsert<'upload'>({
  name: 'handlePathCreation',
  requires: ['validated'],
  provides: [],
  run: async (args) => {
    const { rime } = args.event.locals;
    const data = args.data;

    /**
     * An update that says nothing about the path leaves it alone; a create always has one.
     *
     * `getSegments` answers `root` for a missing *or null* path, which is what makes the second
     * half true — and null is the case that matters, because the blank document a create is
     * merged with puts `_path: null` in `data`. A test for `'_path' in data` therefore never
     * fires on a create, which is why the **adapter** was the thing defaulting it.
     */
    if (args.operation !== 'create' && !args.data._path) return args;

    /**
     * Normalise first — `getSegments` drops empty segments and trailing separators, and
     * collapses a one-segment path to `root`. What is stored has to be the normalised form,
     * because every directory row below is created under it and every lookup goes against it.
     *
     * The **adapter** did this, in `insertPrototype`, behind `'upload' in config` — a feature
     * reaching into a write. It also re-created the directory row for the normalised path,
     * which is what this hook already does and does properly: recursively, for every segment,
     * through the public API. Only the assignment was missing here, and it had to move above
     * the early return below to happen at all.
     *
     * `getSegments` throws `BAD_REQUEST` on an invalid path, which is the same rejection the
     * adapter made, one layer earlier.
     */
    const pathInfo = getSegments(args.data._path);
    args.data._path = pathInfo.path;

    const directorySlug = withDirectoriesSuffix(args.config.slug);

    const [, dir] = await trycatch(() =>
      rime.collection(directorySlug).findById({
        select: ['id'],
        id: data._path
      })
    );

    if (dir) return args;

    // Split the path into segments
    const segments = pathInfo.path.split(UPLOAD_PATH.SEPARATOR);

    // Process all segments, including root
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const parentPath = currentPath || null; // For root, parent is null

      // Build the current path
      currentPath = currentPath ? `${currentPath}${UPLOAD_PATH.SEPARATOR}${segment}` : segment;

      // Check if this segment exists
      const [, segExists] = await trycatch(() =>
        rime.collection(directorySlug).findById({
          select: ['id'],
          id: currentPath
        })
      );

      // If the segment doesn't exist, create it
      if (!segExists) {
        const [createError] = await trycatch(() =>
          rime.collection(directorySlug).create({
            data: {
              id: currentPath,
              parent: parentPath,
              name: segment,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        );

        if (createError) {
          logger.error(`Failed to create directory segment ${currentPath}`, createError);
          // If we can't create a segment, fall back to root
          args.data._path = UPLOAD_PATH.ROOT_NAME;
          return args;
        }
      }
    }

    return args;
  }
});
