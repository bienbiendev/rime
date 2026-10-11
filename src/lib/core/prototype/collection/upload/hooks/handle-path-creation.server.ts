import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { directoriesOf } from '#lib/core/prototype/collection/upload/naming.js';
import { trycatch } from '#lib/util/function.js';
import { getSegments } from '#lib/core/prototype/collection/upload/util/path.js';

/**
 * Runs before a create or update on an upload collection: creates the `$<slug>Directories` rows
 * for the document's `_path`, segment by segment, when they do not exist.
 */
export const handlePathCreation = Hooks.beforeUpsert<'upload'>(
  async function handlePathCreation(args) {
    const { rime } = args.event.locals;
    const data = args.data;

    /**
     * An update that says nothing about the path leaves it alone; a create always has one.
     *
     * `getSegments` answers `root` for a missing *or null* path, which is what makes the second
     * half true — and null is the case that matters, because the initial document a create is
     * merged with puts `_path: null` in `data`. A test for `'_path' in data` therefore never
     * fires on a create.
     */
    if (args.operation !== 'create' && !args.data._path) return args;

    /**
     * Normalise first — `getSegments` drops empty segments and trailing separators, and
     * collapses a one-segment path to `root`. What is stored has to be the normalised form,
     * because every directory row below is created under it and every lookup goes against it.
     *
     * `getSegments` throws `BAD_REQUEST` on an invalid path.
     */
    const pathInfo = getSegments(args.data._path);
    args.data._path = pathInfo.path;

    // The directories are the upload's own bookkeeping: read and created as rime
    const directories = rime.collection(directoriesOf(args.config)).system();

    const [, dir] = await trycatch(() =>
      directories.findById({
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
        directories.findById({
          select: ['id'],
          id: currentPath
        })
      );

      // If the segment doesn't exist, create it
      if (!segExists) {
        const [createError] = await trycatch(() =>
          directories.create({
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
          // Another request may have created it between the read and the create
          const [, createdMeanwhile] = await trycatch(() =>
            directories.findById({ select: ['id'], id: currentPath })
          );
          if (!createdMeanwhile) throw createError;
        }
      }
    }

    return args;
  }
);
