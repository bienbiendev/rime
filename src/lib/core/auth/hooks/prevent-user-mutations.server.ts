import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';

/** What no update of an auth document may change: the sign-in identity and the better-auth link. */
const LOCKED_MEMBERS = ['email', 'name', 'password', 'authUserId'];

/**
 * Refuses an update of an auth document that sends any of `LOCKED_MEMBERS`, whoever the caller
 * is, admins included. On an api-key collection `name` is the key's name.
 */
export const preventUserMutations = Hooks.beforeUpdate<'auth'>(
  async function preventUserMutations(args) {
    if (args.config.auth && LOCKED_MEMBERS.some((key) => key in args.data)) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }
    return args;
  }
);
