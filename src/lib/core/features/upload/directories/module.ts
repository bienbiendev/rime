import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { makeUploadDirectoriesCollectionClient } from '../derive.js';
import { isUploadConfig } from '../util/config.js';

/**
 * Derives a `<slug>Directories` collection for every upload collection in the config.
 *
 * Upload's `configure`, in a module pair of its own rather than beside the augment — the server
 * half needs `operations/pipeline.server.ts`, which imports the feature registry, which imports
 * this feature. Keeping that import out of `../module.server.ts` is what lets the augment and the
 * hooks be read normally; only this one is read lazily. See features/upload/index.ts.
 */
export const configureUploadDirectories = <T extends { collections?: BuiltCollection[] }>(
  config: T
) => {
  const directoriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map(makeUploadDirectoriesCollectionClient);

  return {
    ...config,
    collections: [...(config.collections || []), ...(directoriesCollections || [])]
  };
};
