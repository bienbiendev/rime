import { defineVersionUpdateOperation } from '$lib/core/features/versions/strategy.js';
import { Hooks } from '$lib/core/operations/hooks.js';

export const defineVersionOperation = Hooks.beforeUpdate(async (args) => {
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
});
