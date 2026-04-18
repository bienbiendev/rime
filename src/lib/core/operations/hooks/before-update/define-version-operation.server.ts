import { defineVersionUpdateOperation } from '$lib/core/collections/versions/operations.js';
import { Hooks } from '../index.server.js';

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
