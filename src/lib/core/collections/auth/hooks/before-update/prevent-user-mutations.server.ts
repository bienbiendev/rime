import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';

/**
 * Before update :
 * - prevent email/name/password to be changed
 */
export const preventUserMutations = Hooks.beforeUpdate<'auth'>(async (args) => {
  const IS_MUTATION_AUTH = 'email' in args.data || 'name' in args.data || 'password' in args.data;

  if (IS_MUTATION_AUTH && args.config.auth) {
    if (args.context.isFallbackLocale) {
      delete args.data.password;
    } else {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }
  }

  return args;
});
