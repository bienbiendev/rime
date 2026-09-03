import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/factory/hooks.js';

/**
 * After create populate the created API key
 * on document so user can see it once.
 */
export const populateAPIKey = Hooks.afterCreate<'auth'>({
  name: 'populateAPIKey',
  requires: [],
  provides: [],
  run: async (args) => {
    const { config } = args;

    const IS_API_AUTH = config.auth && config.auth.type === 'apiKey';

    if (IS_API_AUTH) {
      if (!args.context.apiKey)
        throw new RimeError(RimeError.OPERATION_ERROR, 'missing key @populateAPIKey');
      return {
        ...args,
        doc: {
          ...args.doc,
          apiKey: args.context.apiKey
        }
      };
    }

    return args;
  }
});
