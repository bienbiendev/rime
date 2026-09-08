import type { Adapter } from '$lib/core/adapter.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { TreeBlock, PrototypeSlug } from '$lib/core/prototype/types.js';
import type { Dic, WithRequired } from '$lib/util/types.js';
import type { OperationContext } from '../../types.js';
import { defineTreeBlocksDiff } from './diff.server.js';
import { extractTreeBlocks } from './extract.server.js';

export const saveTreeBlocks = async (args: {
  context: OperationContext;
  ownerId: string;
  data: Dic;
  incomingPaths: string[];
  adapter: Adapter;
  /** Whose children these are — the shadow's slug when the prototype has one. Resolved by
   *  `persistRelational` from what the prototype was registered with. */
  ownerSlug: PrototypeSlug;
}) => {
  const { context, ownerId, data, incomingPaths, adapter, ownerSlug } = args;
  const { locale } = context.params;
  const { originalDoc: original, configMap, originalConfigMap } = context;

  if (!configMap || !ownerId) throw new RimeError(RimeError.OPERATION_ERROR, '@saveBlocks');

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

    existingTreeBlocks = blocks.filter((block) => {
      // filter path that are not present in incoming data
      // in order to not delete unmodified blocks fields
      return incomingPaths.some((path) => block.path?.startsWith(path));
    });
  }

  const treeDiff = defineTreeBlocksDiff({
    existingBlocks: existingTreeBlocks,
    incomingBlocks: incomingTreeBlocks,
    context
  });

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
