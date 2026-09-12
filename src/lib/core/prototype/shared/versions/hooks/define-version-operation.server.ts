import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { defineVersionUpdateOperation } from '$lib/core/prototype/shared/versions/strategy.js';

/**
 * Decides which of the five version operations this update is, from `draft`, `versionId` and the
 * config's own `versions.draft`, and puts it on `context.versionOperation`.
 *
 * The five, and what picks each — `defineVersionUpdateOperation` tests them in this order, so the
 * first row that applies wins:
 *
 * ```
 * UPDATE                     no `versions` on the config    reads and writes the document's row
 * UPDATE_VERSION             a `versionId` was given        reads that row, writes it in place
 * NEW_VERSION_FROM_LATEST    versioned, no drafts           reads the newest row, inserts a copy
 * NEW_DRAFT_FROM_PUBLISHED   drafts on, `?draft=true`       reads the published row, inserts a draft
 * UPDATE_PUBLISHED           drafts on, no `draft`          reads the published row, writes it
 * ```
 *
 * Two groupings follow from it, and they are what the other hooks read (`VersionOperations`):
 *
 * - a **new-version** operation (the two `NEW_*`) is inserted by `handleNewVersion` before the
 *   write plan is built, from the original plus the submission — so the plan names no content row
 *   for it, and the row carries the `status` the body gave it, `draft` by default;
 * - a **specific-version** operation (`UPDATE_VERSION`, `UPDATE_PUBLISHED`) writes the row the
 *   original was read from. `demoteOtherVersions` keys on this group, so publishing is expected
 *   to arrive as `status: published` on one of these.
 *
 * "The original" is not decided here: `getOriginalDocument` runs above this hook and asks
 * `versionsReadQuery` with `intent: 'original'`. The two agree by construction — a `versionId`
 * names its row, and without one an update on a draft config always starts from the published
 * row. That is why `?draft=true` means "branch from published" on an update and "show me the
 * newest" on a read.
 */
export const defineVersionOperation = Hooks.beforeUpdate(
  async function defineVersionOperation(args) {
    const { config } = args;

    // Define the kind of update operation depending on versions config
    const versionOperation = defineVersionUpdateOperation({
      draft: args.context.params.draft,
      versionId: args.context.params.versionId,
      config
    });

    return {
      ...args,
      context: {
        ...args.context,
        versionOperation
      }
    };
  }
);
