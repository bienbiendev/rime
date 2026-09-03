import type { Adapter } from '$lib/core/adapter/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { contentOwnerSlug } from '$lib/core/features/versions/naming.js';
import type { GenericBlock } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '../../config-map/types.js';
import type { TreeBlocksDiff } from '../tree/diff.server.js';
import { defineRelationsDiff } from './diff.server.js';
import { extractRelations } from './extract.server.js';

type Diff<T> = {
  toAdd: (Omit<T, 'id'> & { id?: string })[];
  toDelete: T[];
  toUpdate: T[];
};

export const saveRelations = async (args: {
  data: Dic;
  configMap: ConfigMap;
  incomingPaths: string[];
  blocksDiff: Diff<GenericBlock>;
  treeDiff: TreeBlocksDiff;
  adapter: Adapter;
  locale?: string;
  config: BuiltArea | BuiltCollection;
  ownerId: string;
}) => {
  const { configMap, incomingPaths, blocksDiff, treeDiff, adapter, locale, config, ownerId, data } =
    args;

  // Whose children these are: the versions shadow when versioned, the base otherwise.
  const parentSlug = contentOwnerSlug(config);

  /** Delete relations from deletedBlocks */
  await adapter.relations.deleteFromPaths({
    parentSlug,
    ownerId,
    paths: blocksDiff.toDelete.map((block) => `${block.path}.${block.position}`),
    locale
  });

  /** Delete relations from deletedTreeItems */
  await adapter.relations.deleteFromPaths({
    parentSlug,
    ownerId,
    paths: treeDiff.toDelete.map((block) => `${block.path}.${block.position}`),
    locale
  });

  /** Get relations in data */
  const incomingRelations = extractRelations({
    ownerId,
    data,
    configMap,
    locale
  });

  // get existing relations filtered by path
  // if not present in incoming paths don't keep it.
  const existingRelations = await adapter.relations
    .getAll({
      parentSlug,
      ownerId,
      locale: locale
    })
    .then((relations) => {
      // Filter existing relations
      return relations.filter((relation) => {
        return incomingPaths.some((path) => relation.path?.startsWith(path));
      });
    });

  /** get difference between them */
  const relationsDiff = defineRelationsDiff({
    existingRelations,
    incomingRelations,
    locale: locale
  });

  if (relationsDiff.toDelete.length) {
    await adapter.relations.delete({
      parentSlug,
      relations: relationsDiff.toDelete
    });
  }

  if (relationsDiff.toUpdate.length) {
    await adapter.relations.update({
      parentSlug,
      relations: relationsDiff.toUpdate
    });
  }

  if (relationsDiff.toAdd.length) {
    await adapter.relations.create({
      parentSlug,
      ownerId,
      relations: relationsDiff.toAdd
    });
  }

  return relationsDiff;
};
