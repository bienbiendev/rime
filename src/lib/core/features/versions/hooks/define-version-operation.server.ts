import { VERSIONS_MARKS } from '$lib/core/features/versions/marks.js';
import { defineVersionUpdateOperation } from '$lib/core/features/versions/strategy.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

export const defineVersionOperation = Hooks.beforeUpdate({
  name: 'defineVersionOperation',
  requires: [],
  provides: [VERSIONS_MARKS.OPERATION],
  run: async (args) => {
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
});
