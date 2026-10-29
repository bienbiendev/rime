import { RimeError } from '#lib/core/errors/index.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { userAttributes } from '../user.server.js';

/**
 * Sets `event.locals.user` to the user a sign-up just created, for the rest of this request: the
 * hooks and the read that follow the create, and — when an app's form action calls
 * `auth.api.signUpEmail` — the loads after that action. The session cookie is better-auth's.
 *
 * Only the public sign-up path sets the flag this reads (`better-auth/hooks.server.ts`): an admin
 * creating a user from the panel is not signed in as them.
 */
export const signInNewUser = Hooks.afterCreate<'auth'>(async function signInNewUser(args) {
  const { config, event, data } = args;

  if (!event.locals.pendingSignInAfterSignUp) return args;

  if (typeof data.authUserId !== 'string') {
    throw new RimeError(RimeError.OPERATION_ERROR, 'unable to signin user');
  }

  event.locals.user = await userAttributes(event.locals.rime.adapter, {
    authUserId: data.authUserId,
    slug: config.slug
  });

  return args;
});
