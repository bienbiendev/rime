import type { BuiltCollection } from '$lib/core/config/types.js';
import {
  augmentCollectionHooks,
  directoriesPipeline
} from '$lib/core/operations/pipeline.server.js';
import { isUploadConfig, type WithUpload } from './util/config.js';
import { makeUploadDirectoriesCollectionClient } from './derive.js';

export const augmentDirectoriesServer = <T extends { collections?: BuiltCollection[] }>(
  config: T
) => {
  const direcotriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map(makeUploadDirectoriesCollectionServer);

  return {
    ...config,
    collections: [...(config.collections || []), ...(direcotriesCollections || [])]
  } as const;
};

const makeUploadDirectoriesCollectionServer = (collection: WithUpload<BuiltCollection>) => {
  const collectionClient = makeUploadDirectoriesCollectionClient(collection);

  // Hook order for a directories collection lives with every other pipeline, in
  // operations/pipeline.server.ts — not inline here.
  let directoriesCollection: BuiltCollection = {
    ...collectionClient,
    $hooks: directoriesPipeline(collection.upload.directories)
  };

  directoriesCollection = augmentCollectionHooks(directoriesCollection);

  return directoriesCollection;
};
