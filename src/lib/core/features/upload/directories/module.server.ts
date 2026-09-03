import type { BuiltCollection } from '$lib/core/config/types.js';
import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import { collection as collectionPrototype } from '$lib/core/prototype/collection/definition.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';
import { makeUploadDirectoriesCollectionClient } from '../derive.js';
import { isUploadConfig, type WithUpload } from '../util/config.js';
import { directoriesPipeline } from './pipeline.server.js';

/**
 * The return is annotated, not inferred, and it has to be: inferring it would read
 * `collectionPrototype.features` below, and the collection's feature list holds `upload` — this
 * feature, whose `configure` is this function. Same rule as `Rime` and the registry: anything the
 * prototype's own type graph can reach must declare its type rather than derive it.
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

  // A derived collection is still a collection, so it gets the same two pipeline sources an
  // authored one does: the prototype's own hooks and the features its definition lists. They are
  // named separately rather than taken off `definition.server.js` because this module is reached
  // *from* the definition — see the note on `collectionHooks`.
  return augmentHooks(
    { features: collectionPrototype.features, hooks: collectionHooks },
    directoriesCollection
  );
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
): T & { collections: BuiltCollection[] } => {
  const directoriesCollections = config.collections
    ?.filter(isUploadConfig)
    .map(makeUploadDirectoriesCollection);

  return {
    ...config,
    collections: [...(config.collections || []), ...(directoriesCollections || [])]
  };
};
