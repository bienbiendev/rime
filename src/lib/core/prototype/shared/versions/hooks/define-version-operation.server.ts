import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { defineVersionUpdateOperation } from '$lib/core/prototype/shared/versions/strategy.js';

/**
 * Decides which of the five version operations this update is, from `draft`, `versionId` and the
 * config's own `versions.draft`, and puts it on `context.versionOperation`.
 *
 * @TODO explain each of the five, and what picks between them.
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
