import type { Adapter } from '$lib/core/adapter.js';
import type { GenericBlock, PrototypeSlug } from '$lib/core/prototype/types.js';
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
  /** Whose children these are — the versions's slug when the prototype has one. Resolved by
   *  `persistRelational` from what the prototype was registered with. */
  ownerSlug: PrototypeSlug;
  ownerId: string;
}) => {
  const {
    configMap,
    incomingPaths,
    blocksDiff,
    treeDiff,
    adapter,
    locale,
    ownerSlug,
    ownerId,
    data
  } = args;

  /** Delete relations from deletedBlocks */
  await adapter.relations.deleteFromPaths({
    parentSlug: ownerSlug,
    ownerId,
    paths: blocksDiff.toDelete.map((block) => `${block.path}.${block.position}`),
    locale
  });

  /** Delete relations from deletedTreeItems */
  await adapter.relations.deleteFromPaths({
    parentSlug: ownerSlug,
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
      parentSlug: ownerSlug,
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
      parentSlug: ownerSlug,
      relations: relationsDiff.toDelete
    });
  }

  if (relationsDiff.toUpdate.length) {
    await adapter.relations.update({
      parentSlug: ownerSlug,
      relations: relationsDiff.toUpdate
    });
  }

  if (relationsDiff.toAdd.length) {
    await adapter.relations.create({
      parentSlug: ownerSlug,
      ownerId,
      relations: relationsDiff.toAdd
    });
  }

  return relationsDiff;
};
