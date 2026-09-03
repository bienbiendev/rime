import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

/**
 * Before update :
 * - prevent email/name/password to be changed
 */
export const preventUserMutations = Hooks.beforeUpdate<'auth'>({
  name: 'preventUserMutations',
  requires: ['original-doc'],
  // Runs before anything adds to `data`: this reads the caller's submission as sent.
  provides: ['data-inspected'],
  run: async (args) => {
    const IS_MUTATION_AUTH = 'email' in args.data || 'name' in args.data || 'password' in args.data;

    if (IS_MUTATION_AUTH && args.config.auth) {
      if (args.context.isFallbackLocale) {
        delete args.data.password;
      } else {
        throw new RimeError(RimeError.UNAUTHORIZED);
      }
    }

    return args;
  }
});
