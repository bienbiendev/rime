import type { AdapterDeps } from '#lib/adapter-sqlite/types.server.js';
import type { BlocksHandle } from '#lib/core/adapter.js';
import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import type { Dic } from '#lib/util/types.js';
import { baseTableName, tableName } from './naming.server.js';
import { createRepeatable, deleteRepeatable, updateRepeatable } from './repeatable.server.js';

/**
 * A block goes to the table of its type: `pages__$blocks_hero`. Callers name the owner by slug,
 * the prototype's own or its versions', and the table is derived here.
 */
const blockTable = (parentSlug: PrototypeSlug, block: Dic) =>
  tableName({
    owner: baseTableName(parentSlug),
    child: { kind: 'blocks', name: String(block.type) }
  });

const createBlocksHandle = (deps: AdapterDeps): BlocksHandle => ({
  create: ({ parentSlug, block, ownerId, locale }) =>
    createRepeatable(deps, blockTable(parentSlug, block), block, ownerId, locale),
  update: ({ parentSlug, block, locale }) =>
    updateRepeatable(deps, blockTable(parentSlug, block), block, locale),
  delete: ({ parentSlug, block }) => deleteRepeatable(deps, blockTable(parentSlug, block), block.id)
});

export default createBlocksHandle;
