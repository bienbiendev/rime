import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import type { GenericBlock } from '$lib/core/types/doc.js';
import type { Dic } from '$lib/util/types.js';
import type { OperationContext } from '../hooks/index.server.js';
import { defineBlocksDiff } from './diff.server.js';
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
  config: BuiltArea | BuiltCollection;
}) => {
  //
  const { context, ownerId, data, incomingPaths, adapter, config } = args;
  const { locale } = context.params;
  const { originalDoc: original, configMap, originalConfigMap } = context;

  if (!configMap || !ownerId) throw new RimeError(RimeError.OPERATION_ERROR, '@saveBlocks');

  // Determine the correct table name based on versioning configuration
  const parentTable = config.versions ? withVersionsSuffix(config.slug) : config.slug;

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

    // Only consider existing blocks that are in paths being updated
    // This optimization prevents deletion of blocks in unmodified form sections
    // For example, if only "content.hero" was modified, we don't want to
    // accidentally delete blocks in "content.footer"
    existingBlocks = blocks.filter((block) => {
      return incomingPaths.some((path) => block.path?.startsWith(path));
    });
  }

  // Calculate what blocks need to be added, updated, or deleted
  // This handles localization logic and compares block properties
  const blocksDiff = defineBlocksDiff({
    existingBlocks,
    incomingBlocks,
    context
  });

  // Execute delete operations first to avoid potential conflicts
  if (blocksDiff.toDelete.length) {
    await Promise.all(
      blocksDiff.toDelete.map((block) => adapter.blocks.delete({ parentSlug: parentTable, block }))
    );
  }

  // Create new blocks (blocks without IDs or with temporary IDs)
  if (blocksDiff.toAdd.length) {
    await Promise.all(
      blocksDiff.toAdd.map((block) =>
        adapter.blocks.create({
          parentSlug: parentTable,
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
        adapter.blocks.update({ parentSlug: parentTable, block, locale: locale })
      )
    );
  }

  return blocksDiff;
};
