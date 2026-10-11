import type { Adapter } from '#lib/core/adapter.js';
import type { GenericBlock, PrototypeSlug, TreeBlock } from '#lib/core/prototype/types.js';
import type { Dic, WithRequired } from '#lib/util/types.js';
import type { ConfigMap } from '../../config-map/types.js';
import { replacedPaths, withinPaths, type RepeatablesDiff } from '../repeatable.server.js';
import { defineRelationsDiff } from './diff.server.js';
import { extractRelations } from './extract.server.js';

export const saveRelations = async (args: {
  data: Dic;
  configMap: ConfigMap;
  incomingPaths: string[];
  blocksDiff: RepeatablesDiff<GenericBlock>;
  treeDiff: RepeatablesDiff<WithRequired<TreeBlock, 'path'>>;
  adapter: Adapter;
  locale?: string;
  /** Whose children these are: the versions table's slug when the config has one, else its own. */
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

  const existingRelations = await adapter.relations
    .getAll({
      parentSlug: ownerSlug,
      ownerId,
      locale: locale
    })
    .then((relations) => withinPaths(relations, replacedPaths(incomingPaths, configMap)));

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
