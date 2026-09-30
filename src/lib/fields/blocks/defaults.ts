import { completeItem } from '$lib/core/fields/complete.js';
import type { Dic } from '$lib/util/types.js';
import type { BlockBuilder } from './index.js';

/** A block in a default: its `type`, and the values it starts with. */
export type BlockDefault = { type: string } & Dic;

/**
 * A default list of blocks as a document holds it: each block with a fresh temporary id and the
 * initial values of its type's other fields, the values it names winning. A new copy on each call.
 *
 * ```ts
 * completeBlocks('sections', [grid, paragraph], [{ type: 'grid', items: [{ type: 'paragraph' }] }]);
 * // [{
 * //   id: 'temp-3f9a…', type: 'grid', path: null, position: null, title: null,
 * //   items: [{ id: 'temp-8c1d…', type: 'paragraph', path: null, position: null, text: null }]
 * // }]
 * ```
 *
 * `path` and `position` stay `null`: the server reads them from where the block sits, the panel
 * from its index. A block without a real id is added on save.
 */
export const completeBlocks = (
  field: string,
  blocks: BlockBuilder[],
  value: BlockDefault[]
): Dic[] =>
  value.map((given) => {
    const block = blocks.find((candidate) => candidate.name === given?.type);
    if (!block) {
      throw new Error(`${field}.defaultValue(): "${given?.type}" is not a block of ${field}`);
    }
    return { ...completeItem(block.get.fields, given), type: block.name };
  });
