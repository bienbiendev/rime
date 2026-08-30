import { augmentHooks } from '$lib/core/collections/config/augment-hooks.server.js';
import { exctractPath } from '$lib/core/features/upload/hooks/extract-path.server.js';
import {
  prepareDirectoryChildren,
  updateDirectoryChildren
} from '$lib/core/features/upload/hooks/update-directory-children.server.js';
import { isUploadConfig, type WithUpload } from '$lib/core/features/upload/util/config.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
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
  const directoriesConfig = collection.upload.directories;

  let directoriesCollection: BuiltCollection = {
    ...collectionClient,
    $hooks: {
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
    }
  };

  directoriesCollection = augmentHooks(directoriesCollection);

  return directoriesCollection;
};
