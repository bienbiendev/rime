import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { userAttributes } from '../user.server.js';

/**
 * Signs a user in as soon as their own sign-up created them.
 *
 * Better-auth's sign-up handler sets `event.locals.pendingSignInAfterSignUp`, and this reads it: the document
 * exists by now, so `event.locals.user` can be populated from it and the response comes back
 * already authenticated. Only the public sign-up path sets that flag — an admin creating a user
 * from the panel must not be signed in as them.
 *
 * `authUserId` comes off `data`, which `createBetterAuthUser` set — not off the caller's incoming
 * data, where it is only present on the public sign-up path.
 */
export const signInNewUser = Hooks.afterCreate<'auth'>(async function signInNewUser(args) {
  const { config, event, data } = args;

  if (!event.locals.pendingSignInAfterSignUp) return args;

  if (
    typeof data.name !== 'string' ||
    typeof data.email !== 'string' ||
    typeof data.authUserId !== 'string'
  ) {
    throw new RimeError(RimeError.OPERATION_ERROR, 'unable to signin user');
  }

  event.locals.user = await userAttributes(event.locals.rime.adapter, {
    authUserId: data.authUserId,
    slug: config.slug
  });

  return args;
});
