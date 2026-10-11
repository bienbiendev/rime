import type { Adapter } from '#lib/core/adapter.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { GenericBlock, PrototypeSlug } from '#lib/core/prototype/types.js';
import type { Dic } from '#lib/util/types.js';
import type { OperationContext } from '../../types.js';
import { diffRepeatables, replacedPaths, withinPaths } from '../repeatable.server.js';
import { extractBlocks } from './extract.server.js';

/**
 * Saves blocks to the database by comparing incoming blocks with existing ones
 * and performing create, update, and delete operations as needed.
 *
 * This function handles the complete lifecycle of block persistence:
 * 1. Extract blocks from form data
 * 2. Compare with existing blocks to determine changes
 * 3. Execute database operations (create/update/delete)
 */
export const saveBlocks = async (args: {
  context: OperationContext;
  ownerId: string;
  data: Dic;
  incomingPaths: string[];
  adapter: Adapter;
  /** Whose children these are: the versions table's slug when the config has one, else its own. */
  ownerSlug: PrototypeSlug;
}) => {
  //
  const { context, ownerId, data, incomingPaths, adapter, ownerSlug } = args;
  const { locale } = context.params;
  const { originalDoc: original, configMap, originalConfigMap } = context;

  if (!configMap || !ownerId) throw new RimeError(RimeError.OPERATION_ERROR, '@saveBlocks');

  // Extract all blocks from the incoming form data using the current config
  const incomingBlocks = extractBlocks({
    data,
    configMap
  });

  let existingBlocks: GenericBlock[] = [];

  // If we have an original document (i.e., this is an update operation)
  if (original) {
    if (!originalConfigMap) throw new RimeError(RimeError.OPERATION_ERROR, 'missing original');

    // Extract blocks from the original document using its config
    const blocks = extractBlocks({
      data: original,
      configMap: originalConfigMap
    });

    // Only the blocks inside the paths this save replaces: blocks of a member it does not send
    // stay as they are
    existingBlocks = withinPaths(blocks, replacedPaths(incomingPaths, configMap));
  }

  const blocksDiff = diffRepeatables<GenericBlock>(
    existingBlocks,
    incomingBlocks as GenericBlock[]
  );

  // Execute delete operations first to avoid potential conflicts
  if (blocksDiff.toDelete.length) {
    await Promise.all(
      blocksDiff.toDelete.map((block) => adapter.blocks.delete({ parentSlug: ownerSlug, block }))
    );
  }

  // Create new blocks (blocks without IDs or with temporary IDs)
  if (blocksDiff.toAdd.length) {
    await Promise.all(
      blocksDiff.toAdd.map((block) =>
        adapter.blocks.create({
          parentSlug: ownerSlug,
          ownerId,
          block,
          locale
        })
      )
    );
  }

  // Update existing blocks that have changed properties
  if (blocksDiff.toUpdate.length) {
    await Promise.all(
      blocksDiff.toUpdate.map((block) =>
        adapter.blocks.update({ parentSlug: ownerSlug, block, locale: locale })
      )
    );
  }

  return blocksDiff;
};
