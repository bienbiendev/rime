import type { Adapter } from '#lib/core/adapter.js';
import type { GenericBlock, PrototypeSlug, TreeBlock } from '#lib/core/prototype/types.js';
import type { Dic, WithRequired } from '#lib/util/types.js';
import type { ConfigMap } from '../../config-map/types.js';
import {
  movedPath,
  placeOf,
  replacedPaths,
  withinPaths,
  type RepeatablesDiff
} from '../repeatable.server.js';
import { defineRelationsDiff } from './diff.server.js';
import { extractRelations } from './extract.server.js';

/**
 * Writes a save's relations: drops the relations under the block and tree rows the save
 * deleted, moves the other locales' relations under the rows it moved, then compares the stored
 * relations inside the paths the save replaces (a group's own path excluded) with the ones the
 * data names, and deletes, updates and adds rows.
 */
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

  /** A blocks or tree row is every locale's when its list field is not localized. */
  const isShared = (row: { path?: string }) => {
    // A tree item's list is its tree: `menu.0._children.1._children` -> `menu`
    const list = configMap[row.path!.replace(/(\.\d+\._children)+$/, '')];
    return !!list && !list.get.localized;
  };

  // The relations under a removed row go with it: in every locale when its list is shared, in the
  // request locale when the list is localized
  const removed = [...blocksDiff.toDelete, ...treeDiff.toDelete];
  await adapter.relations.deleteFromPaths({
    parentSlug: ownerSlug,
    ownerId,
    paths: removed.filter(isShared).map(placeOf)
  });
  await adapter.relations.deleteFromPaths({
    parentSlug: ownerSlug,
    ownerId,
    paths: removed.filter((row) => !isShared(row)).map(placeOf),
    locale
  });

  // The data places the request locale's relations. The other locales' relations under a moved
  // row of a shared list move with it.
  const moves = [...blocksDiff.moved, ...treeDiff.moved].filter(isShared);
  if (locale && moves.length) {
    // `getAll` with no locale answers every locale's rows
    const followed = (await adapter.relations.getAll({ parentSlug: ownerSlug, ownerId })).flatMap(
      (row) => {
        const path = row.locale && row.locale !== locale ? movedPath(row.path, moves) : null;
        return path ? [{ ...row, path }] : [];
      }
    );
    if (followed.length) {
      await adapter.relations.update({ parentSlug: ownerSlug, relations: followed });
    }
  }

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
