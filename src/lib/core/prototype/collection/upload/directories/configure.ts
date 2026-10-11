import type { BuiltCollection } from '#lib/core/config/types.js';
import { isUploadConfig } from '#lib/core/prototype/collection/upload/util/config.js';
import { makeUploadDirectoriesCollectionClient } from './derive.js';

/**
 * Derives a `<slug>Directories` collection for every upload collection in the config.
 *
 * The client half: the derived collections without hooks. `configure.server.ts` adds their
 * pipeline from `./pipeline.server.ts`.
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
