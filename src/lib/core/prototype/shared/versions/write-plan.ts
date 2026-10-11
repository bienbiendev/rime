import { splitRootData } from '#lib/core/fields/util.js';
import type { WritePlan } from '#lib/core/adapter.js';
import type { OperationContext } from '#lib/core/pipeline/types.js';
import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import { VersionOperations } from './strategy.js';

/**
 * A versioned document's write lands on two rows: its identity on the base row, its content on a
 * version row.
 *
 * Stated once, above the adapter, in the feature that owns the distinction:
 *
 * ```
 * not versioned        the plan untouched — the base row holds everything
 * a specific version   split, and name the row
 * a new version        split, and name no row: handleNewVersion already wrote it
 * a create             split, and name no row: none exists yet
 * ```
 *
 * `splitRootData` is what makes a versioned config keep its `$root()` fields on the base row, and
 * it is this feature's rule to apply, not the adapter's.
 *
 * `context.contentOwnerId` is where this document's blocks, tree nodes and relations hang. The
 * plan's `content` is the version row this write touches: none for a new version, which
 * `handleNewVersion` already wrote. They name the same row when both are set.
 */
export const versionsWritePlan = (
  plan: WritePlan,
  args: {
    config: BuiltArea | BuiltCollection;
    context: OperationContext;
    operation: 'create' | 'update';
  }
): WritePlan => {
  // Not versioned: the whole document is on its own row and there is nothing to split.
  if (!args.config.versions) return plan;

  const { versionOperation, contentOwnerId } = args.context;

  // The `$root()` fields stay on the base row; a versions table has no column for them.
  const { base, content } = splitRootData(plan.data, args.config);

  // No row to name: this document has no version yet, and the adapter makes the first one.
  if (args.operation === 'create') return { data: base, content: { data: content } };

  return VersionOperations.isNewVersionCreation(versionOperation!)
    ? { data: base }
    : { data: base, content: { id: contentOwnerId!, data: content } };
};
