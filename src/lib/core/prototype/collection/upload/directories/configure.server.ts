import type { BuiltCollection } from '#lib/core/config/types.js';
import { isUploadConfig, type WithUpload } from '../util/config.js';
import { makeUploadDirectoriesCollectionClient } from './derive.js';
import { directoriesPipeline } from './pipeline.server.js';

const makeUploadDirectoriesCollection = (
  collection: WithUpload<BuiltCollection>
): BuiltCollection => {
  const collectionClient = makeUploadDirectoriesCollectionClient(collection);

  // Hook order for a directories collection sits beside this file, in ./pipeline.server.ts —
  // upload's own derived collection, so upload owns its order.
  const directoriesCollection: BuiltCollection = {
    ...collectionClient,
    $hooks: directoriesPipeline(collection.upload.directories)
  };

  return directoriesCollection;
};

/**
 * The server half of the derivation: a `<slug>Directories` collection per upload collection.
 *
 * They land before `resolvePipelines` (`pipeline/build.server.ts`) runs, so each one is resolved
 * like an authored collection.
 */
export const configureUploadDirectories = <T extends { collections?: BuiltCollection[] }>(
  config: T
): T & { collections: BuiltCollection[] } => {
  const directoriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map(makeUploadDirectoriesCollection);

  return {
    ...config,
    collections: [...(config.collections || []), ...(directoriesCollections || [])]
  };
};
