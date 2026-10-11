import type { AdapterDeps } from '#lib/adapter-sqlite/types.server.js';
import type { TreeHandle } from '#lib/core/adapter.js';
import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import type { Dic } from '#lib/util/types.js';
import { extractFieldName } from '#lib/fields/tree/util.js';
import { baseTableName, tableName } from './naming.server.js';
import { createRepeatable, deleteRepeatable, updateRepeatable } from './repeatable.server.js';

/** A tree item goes to the table of its tree field: `pages__$tree_nav`. */
const treeTable = (parentSlug: PrototypeSlug, item: Dic) =>
  tableName({
    owner: baseTableName(parentSlug),
    child: { kind: 'tree', name: extractFieldName(String(item.path))[0] }
  });

const createTreeHandle = (deps: AdapterDeps): TreeHandle => ({
  create: ({ parentSlug, block, ownerId, locale }) =>
    createRepeatable(deps, treeTable(parentSlug, block), block, ownerId, locale),
  update: ({ parentSlug, block, locale }) =>
    updateRepeatable(deps, treeTable(parentSlug, block), block, locale),
  delete: ({ parentSlug, block }) =>
    deleteRepeatable(deps, treeTable(parentSlug, block), String(block.id))
});

export default createTreeHandle;
