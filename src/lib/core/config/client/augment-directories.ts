import { isUploadConfig } from '$lib/core/collections/upload/util/config.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { makeUploadDirectoriesCollectionClient } from '../shared/upload-directories';

export const augmentDirectories = <T extends { collections?: BuiltCollection[] }>(config: T) => {
  const direcotriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map(makeUploadDirectoriesCollectionClient);

  return {
    ...config,
    collections: [...(config.collections || []), ...(direcotriesCollections || [])]
  } as const;
};
