import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import type { GenericBlock } from '$lib/core/types/doc.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '../configMap/types.js';
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

  const parentTable = config.versions ? withVersionsSuffix(config.slug) : config.slug;

  /** Delete relations from deletedBlocks */
  await adapter.relations.deleteFromPaths({
    parentSlug: parentTable,
    ownerId,
    paths: blocksDiff.toDelete.map((block) => `${block.path}.${block.position}`),
    locale
  });

  /** Delete relations from deletedTreeItems */
  await adapter.relations.deleteFromPaths({
    parentSlug: parentTable,
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
      parentSlug: parentTable,
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
      parentSlug: parentTable,
      relations: relationsDiff.toDelete
    });
  }

  if (relationsDiff.toUpdate.length) {
    await adapter.relations.update({
      parentSlug: parentTable,
      relations: relationsDiff.toUpdate
    });
  }

  if (relationsDiff.toAdd.length) {
    await adapter.relations.create({
      parentSlug: parentTable,
      ownerId,
      relations: relationsDiff.toAdd
    });
  }

  return relationsDiff;
};
