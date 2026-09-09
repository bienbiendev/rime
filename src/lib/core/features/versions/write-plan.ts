import { splitRootData } from '$lib/core/fields/util.js';
import type { WritePlan } from '../define.js';
import type { OperationContext } from '$lib/core/pipeline/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { VersionOperations } from './strategy.js';

/**
 * A versioned document's write lands on two rows: its identity on the base row, its content on a
 * version row.
 *
 * This is the three-way branch `updatePrototype` used to decode out of `versionOperation`, stated
 * once, above the adapter, in the feature that owns the distinction:
 *
 * - **not versioned** — never reached; `enabled` gates this, so the default plan stands and the
 *   base row holds everything.
 * - **a specific version** (`UPDATE_VERSION`, `UPDATE_PUBLISHED`) — split, and name the row.
 * - **a new version** (`NEW_VERSION_FROM_LATEST`, `NEW_DRAFT_FROM_PUBLISHED`) — split, and name no
 *   row: `handleNewVersion` already wrote it, through the public API, before this ran.
 *
 * A **create** is the fourth case and the simplest: split, and name no row because none exists —
 * the adapter writes the first version and answers with its id. The split used to happen inside
 * `insertPrototype`, which meant the adapter knew that a shadowed config keeps its `._root()`
 * fields on the base row. It is the same `splitRootData` call, made by whoever declared the
 * shadow.
 *
 * `context.contentOwnerId` is the row, and it is not the same question as this plan's `content`.
 * That one is "where do this document's blocks, tree nodes and relations hang", which has an
 * answer in all three cases; this is "which rows does *this write* touch", which has none in the
 * third. They name the same row when they are both set.
 */
export const versionsWritePlan = (
  plan: WritePlan,
  args: {
    config: BuiltArea | BuiltCollection;
    context: OperationContext;
    operation: 'create' | 'update';
  }
): WritePlan => {
  const { versionOperation, contentOwnerId } = args.context;

  // The `._root()` fields stay on the base row; a shadow has no column for them.
  const { base, content } = splitRootData(plan.data, args.config);

  // No row to name: this document has no version yet, and the adapter makes the first one.
  if (args.operation === 'create') return { data: base, content: { data: content } };

  return VersionOperations.isNewVersionCreation(versionOperation!)
    ? { data: base }
    : { data: base, content: { id: contentOwnerId!, data: content } };
};
