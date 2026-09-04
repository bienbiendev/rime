import type { BuiltCollection } from '$lib/core/config/types.js';
import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import type { FeatureDefinition } from '$lib/core/features/define.js';
import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';
import { makeUploadDirectoriesCollectionClient } from '../derive.js';
import { isUploadConfig, type WithUpload } from '../util/config.js';
import { directoriesPipeline } from './pipeline.server.js';

/**
 * The return is annotated, not inferred, and it has to be: the collection's feature list holds
 * `upload` — this feature, whose `configure` is this function — so inferring it would put the
 * list in its own type graph. Same rule as `Rime` and the registries.
 */
const makeUploadDirectoriesCollection = (
  collection: WithUpload<BuiltCollection>,
  features: FeatureDefinition[]
): BuiltCollection => {
  const collectionClient = makeUploadDirectoriesCollectionClient(collection);

  // Hook order for a directories collection sits beside this file, in ./pipeline.server.ts —
  // upload's own derived collection, so upload owns its order.
  const directoriesCollection: BuiltCollection = {
    ...collectionClient,
    $hooks: directoriesPipeline(collection.upload.directories)
  };

  // A derived collection is still a collection, so it gets the same two pipeline sources an
  // authored one does: the prototype's own hooks, and the features it lists. Both arrive without
  // importing a definition — the features from the registry `configure` is handed, the hooks from
  // a file that depends on nothing.
  return augmentHooks({ features, hooks: collectionHooks }, directoriesCollection);
};

/**
 * The server half of the derivation: the same collections, with their pipelines attached.
 *
 * The collection prototype's features come from the registry `configure` is handed, never from
 * importing its definition: a definition lists its features by value, so a feature reaching back
 * for one can be evaluated from inside it and find whichever feature is still in flight
 * `undefined` — including itself.
 */
export const configureUploadDirectories = <T extends { collections?: BuiltCollection[] }>(
  config: T,
  prototypes: RegisteredPrototype[] = []
): T & { collections: BuiltCollection[] } => {
  const features = prototypes.find((prototype) => prototype.name === 'collection')?.features || [];

  const directoriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map((collection) => makeUploadDirectoriesCollection(collection, features));

  return {
    ...config,
    collections: [...(config.collections || []), ...(directoriesCollections || [])]
  };
};
