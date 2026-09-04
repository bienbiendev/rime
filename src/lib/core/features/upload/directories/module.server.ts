import type { BuiltCollection } from '$lib/core/config/types.js';
import { makeUploadDirectoriesCollectionClient } from '../derive.js';
import { isUploadConfig, type WithUpload } from '../util/config.js';
import { directoriesPipeline } from './pipeline.server.js';

/**
 * The return is annotated, not inferred: the collection's feature list holds `upload` — this
 * feature, whose `configure` is this function — so inferring it would put the list in its own type
 * graph. Same rule as `Rime` and the registries.
 */
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

  // Its pipeline is resolved after this runs, by the step that resolves every prototype config —
  // see prototype/pipelines.server.ts. Nothing to build here.
  return directoriesCollection;
};

/**
 * The server half of the derivation: a `<slug>Directories` collection per upload collection.
 *
 * They land before the config chain resolves any pipeline, so each one is resolved by the same
 * step that resolves an authored collection — nothing here builds one.
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
