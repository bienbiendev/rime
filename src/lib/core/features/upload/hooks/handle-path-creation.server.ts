import { UPLOAD_PATH } from '$lib/core/constant.js';
import { logger } from '$lib/core/logger/index.server.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { trycatch } from '$lib/util/function.js';
import { getSegments } from '../util/path.js';

/**
 * Hook executed before save/update operations on an upload collections
 * the function get the document _path and check if it exists,
 * if it doesn't it create {upload_slug}_directories entries recursively
 */
export const handlePathCreation = Hooks.beforeUpsert<'upload'>(async (args) => {
  const { rime } = args.event.locals;
  const data = args.data;

  const IS_CREATE_WITHOUT_PATH = !('_path' in args.data) && args.operation === 'create';

  if (IS_CREATE_WITHOUT_PATH) {
    args.data._path = 'root';
  }

  if (args.data._path) {
    const directorySlug = withDirectoriesSuffix(args.config.slug);

    const [, dir] = await trycatch(() =>
      rime.collection(directorySlug).findById({
        select: ['id'],
        id: data._path
      })
    );

    if (dir) return args;

    // Use the getSegments utility to extract path information
    const pathInfo = getSegments(data._path);

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
  }

  return args;
});
