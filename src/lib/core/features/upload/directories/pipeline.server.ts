import type { CollectionHooks } from '$lib/types.js';
import { exctractPath } from '../hooks/extract-path.server.js';
import {
  prepareDirectoryChildren,
  updateDirectoryChildren
} from '../hooks/update-directory-children.server.js';

/**
 * The hooks for an upload collection's derived `<slug>_directories` collection.
 *
 * It used to live in the one shared `operations/pipeline.server.ts`, so that every pipeline rime
 * runs was readable in one file. Splitting that file per prototype retired the reason, and this
 * is upload's own derived collection — the same rule that put `uploadHooks` here. The result is
 * still passed through `augmentCollectionHooks`, exactly like an author-written collection.
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
