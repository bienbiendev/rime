import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import {
  augmentCollectionHooks,
  directoriesPipeline
} from '$lib/core/operations/pipeline.server.js';
import { makeUploadDirectoriesCollectionClient } from '../derive.js';
import { isUploadConfig, type WithUpload } from '../util/config.js';

const makeUploadDirectoriesCollection = (collection: WithUpload<BuiltCollection>) => {
  const collectionClient = makeUploadDirectoriesCollectionClient(collection);

  // Hook order for a directories collection lives with every other pipeline, in
  // operations/pipeline.server.ts — not inline here.
  const directoriesCollection: BuiltCollection = {
    ...collectionClient,
    $hooks: directoriesPipeline(collection.upload.directories)
  };

  return augmentCollectionHooks(directoriesCollection);
};

/**
 * The server half of the derivation: the same collections, with their pipelines attached.
 *
 * This is the file that closes a cycle — pipeline.server.ts imports the registry, the registry
 * imports upload, upload's definition imports `$rime/modules`, and the barrel evaluates this. The
 * definition therefore reads this export inside a closure rather than at module scope, which is
 * the standard remedy: by the time `configure` is called the cycle has long resolved.
 */
export const configureUploadDirectories = <T extends { collections?: BuiltCollection[] }>(
  config: T
) => {
  const directoriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map(makeUploadDirectoriesCollection);

  return {
    ...config,
    collections: [...(config.collections || []), ...(directoriesCollections || [])]
  };
};
