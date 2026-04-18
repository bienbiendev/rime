import { RimeError } from '$lib/core/errors/index.js';
import type { GenericBlock } from '$lib/core/types/doc.js';
import type { WithOptional } from '$lib/util/types.js';
import type { OperationContext } from '../hooks/index.server.js';

type BlocksDiff = {
  toAdd: WithOptional<GenericBlock, 'id'>[];
  toDelete: GenericBlock[];
  toUpdate: GenericBlock[];
};

type DefineBlocksDiffArgs = {
  existingBlocks: GenericBlock[];
  incomingBlocks: WithOptional<GenericBlock, 'id'>[];
  context: OperationContext;
};

// Utility to filter out blocks that haven't id
const blockHasId = (b: WithOptional<GenericBlock, 'id'>): b is GenericBlock => !!b.id;

export function defineBlocksDiff({
  existingBlocks,
  incomingBlocks,
  context
}: DefineBlocksDiffArgs): BlocksDiff {
  const configMap = context.configMap;
  if (!configMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing configMap @defineBlocksDiff');

  // On fallback locale :
  // - If a block is localized, it should not keep its id so a new one is created
  // - If a block is not localized than it should keep its id so block is updated
  if (context.isFallbackLocale) {
    incomingBlocks = incomingBlocks.map((block) => {
      const isLocalized: boolean = configMap[block.path]?.localized || false;
      if (isLocalized) {
        delete block.id;
        block.locale = context.isFallbackLocale;
      }
      return block;
    });
  }

  /////////////////////////////////////////////
  // Handle add diff
  //////////////////////////////////////////////

  // Consider blocks as new if they have temp ID OR no ID at all
  const toAdd = incomingBlocks.filter((block) => !block.id || block.id.startsWith('temp-'));

  /////////////////////////////////////////////
  // Handle delete diff
  //////////////////////////////////////////////

  // Consider block to be deleted if its id is not present in incomingBlocks
  // Note: Existing blocks have been filtered before diff
  // by removing elements with a path not present in incoming data,
  // in order to not delete unmodified blocks fields
  const toDelete = existingBlocks.filter((existing) => {
    return !incomingBlocks.filter(blockHasId).some((newBlock) => {
      // Only compare blocks that have real IDs
      if (newBlock.id.startsWith('temp-')) return false;
      return newBlock.id === existing.id;
    });
  });

  /////////////////////////////////////////////
  // Handle update diff
  //////////////////////////////////////////////

  // Consider a block that need update :
  // if its id is present in existing blocks and
  // if they didn't share same (normalized) props

  /**
   * Compare two potential equals block
   * based on prop normalization and JSON comparaison
   */
  function isEqualValues(old: GenericBlock, incoming: GenericBlock) {
    // Remove nested blocks to compare block values
    const normalizeForComparison = (block: GenericBlock) => {
      return Object.entries(block).reduce((acc, [key, value]) => {
        if (Array.isArray(value) && value[0]?.type) {
          return acc;
        }
        return { ...acc, [key]: value };
      }, {});
    };
    // Compare
    const normalizedOld = normalizeForComparison(old);
    const normalizedNew = normalizeForComparison(incoming);
    return JSON.stringify(normalizedOld) === JSON.stringify(normalizedNew);
  }

  /**
   * Check wether a block need to be updated
   */
  function needUpdate(newBlock: GenericBlock) {
    // Skip blocks with temp IDs
    if (newBlock.id.startsWith('temp-')) return false;
    // Check in incomming block if one has the same id than this one
    const existing = existingBlocks.find((e) => e.id === newBlock.id);
    if (!existing) return false;
    // return comparaison
    return !isEqualValues(existing, newBlock);
  }

  const toUpdate = incomingBlocks.filter(blockHasId).filter(needUpdate);

  return { toAdd, toDelete, toUpdate };
}
