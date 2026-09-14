import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { defineVersionUpdateOperation } from '$lib/core/prototype/shared/versions/strategy.js';

/**
 * Decides what this update does to the row it selected, and puts it on
 * `context.versionOperation` — see `defineVersionUpdateOperation` for the table.
 *
 * Which row, is already decided: `getOriginalDocument` ran above and read the row `versionId`
 * names, else the newest with `latest`, else the published one, exactly as a read would. Two
 * groupings follow, and they are what the other hooks read (`VersionOperations`):
 *
 * - a **new-version** operation (`NEW_VERSION`, `NEW_AUTO_SAVE_FROM_VERSION`) is inserted by
 *   `handleNewVersion` before the write plan is built, from the original plus the submission — so
 *   the plan names no content row for it, and the row carries the `status` the body gave it,
 *   `draft` by default; an auto-save carries the status of the row it branched from, which is
 *   what it becomes when saved;
 * - `UPDATE_VERSION` writes the row the original was read from. When that write is not an
 *   auto-save it also clears `isAutoSave` on its row: that is how an auto-save is promoted.
 *
 * `demoteOtherVersions` runs for either group when the body says `published`.
 */
export const defineVersionOperation = Hooks.beforeUpdate(
  async function defineVersionOperation(args) {
    const { config } = args;

    const versionOperation = defineVersionUpdateOperation({
      versionId: args.context.params.versionId,
      fork: args.context.params.fork,
      autoSave: args.context.params.autoSave,
      originalIsAutoSave: !!args.context.originalDoc?.isAutoSave,
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
