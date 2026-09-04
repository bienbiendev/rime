import type { CollectionHooks } from '$lib/types.js';
import { exctractPath } from '../hooks/extract-path.server.js';
import {
  prepareDirectoryChildren,
  updateDirectoryChildren
} from '../hooks/update-directory-children.server.js';

/**
 * The hooks for an upload collection's derived `<slug>_directories` collection.
 *
 * Upload's own derived collection, so its pipeline belongs to upload — the same rule that puts
 * `uploadHooks` here. The result goes through `augmentHooks` like an author-written collection.
 */
export const directoriesPipeline = (
  directoriesConfig: { $hooks?: CollectionHooks<any> } | undefined
): CollectionHooks<any> => ({
  beforeOperation: directoriesConfig?.$hooks?.beforeOperation || [],
  beforeCreate: [exctractPath, ...(directoriesConfig?.$hooks?.beforeCreate || [])],
  beforeRead: directoriesConfig?.$hooks?.beforeRead || [],
  beforeUpdate: [
    exctractPath,
    prepareDirectoryChildren,
    ...(directoriesConfig?.$hooks?.beforeUpdate || [])
  ],
  beforeDelete: directoriesConfig?.$hooks?.beforeDelete || [],
  afterCreate: directoriesConfig?.$hooks?.afterCreate || [],
  afterUpdate: [updateDirectoryChildren, ...(directoriesConfig?.$hooks?.afterUpdate || [])],
  afterDelete: directoriesConfig?.$hooks?.afterDelete || []
});
