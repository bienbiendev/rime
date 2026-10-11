import type { Adapter } from '#lib/core/adapter.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { TreeBlock, PrototypeSlug } from '#lib/core/prototype/types.js';
import type { Dic, WithRequired } from '#lib/util/types.js';
import type { OperationContext } from '../../types.js';
import { diffRepeatables, replacedPaths, withinPaths } from '../repeatable.server.js';
import { extractTreeBlocks } from './extract.server.js';

export const saveTreeBlocks = async (args: {
  context: OperationContext;
  ownerId: string;
  data: Dic;
  incomingPaths: string[];
  adapter: Adapter;
  /** Whose children these are: the versions table's slug when the config has one, else its own. */
  ownerSlug: PrototypeSlug;
}) => {
  const { context, ownerId, data, incomingPaths, adapter, ownerSlug } = args;
  const { locale } = context.params;
  const { originalDoc: original, configMap, originalConfigMap } = context;

  if (!configMap || !ownerId) throw new RimeError(RimeError.OPERATION_ERROR, '@saveTreeBlocks');

  // Get incomings
  const incomingTreeBlocks = extractTreeBlocks({
    data,
    configMap
  });

  // Get existings
  let existingTreeBlocks: WithRequired<TreeBlock, 'path'>[] = [];
  if (original) {
    if (!originalConfigMap) throw new RimeError(RimeError.OPERATION_ERROR, 'missing original');
    const blocks = extractTreeBlocks({
      data: original,
      configMap: originalConfigMap
    });

    // Only the items inside the paths this save replaces
    existingTreeBlocks = withinPaths(blocks, replacedPaths(incomingPaths, configMap));
  }

  const treeDiff = diffRepeatables(existingTreeBlocks, incomingTreeBlocks);

  if (treeDiff.toDelete.length) {
    await Promise.all(
      treeDiff.toDelete.map((block) => adapter.tree.delete({ parentSlug: ownerSlug, block }))
    );
  }

  if (treeDiff.toAdd.length) {
    await Promise.all(
      treeDiff.toAdd.map((block) =>
        adapter.tree.create({
          parentSlug: ownerSlug,
          ownerId,
          block,
          locale: locale
        })
      )
    );
  }

  if (treeDiff.toUpdate.length) {
    await Promise.all(
      treeDiff.toUpdate.map((block) =>
        adapter.tree.update({ parentSlug: ownerSlug, block, locale: locale })
      )
    );
  }

  return treeDiff;
};
