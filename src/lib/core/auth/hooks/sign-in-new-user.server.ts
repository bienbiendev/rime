import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { userAttributes } from '../user.server.js';

/**
 * Signs a user in as soon as their own sign-up created them.
 *
 * Better-auth's sign-up handler sets `event.locals.isAutoSignIn`, and this reads it: the document
 * exists by now, so `event.locals.user` can be populated from it and the response comes back
 * already authenticated. Only the public sign-up path sets that flag — an admin creating a user
 * from the panel must not be signed in as them.
 *
 * **This lived in `collection/operations/create.ts`**, twenty lines after the insert, behind
 * `if (config.auth && event.locals.isAutoSignIn)` — the last place core's create branched on a
 * feature's config member. It also read `authUserId` off the *incoming* data rather than what the
 * hooks produced, which happened to work because the one path that reaches it is the one where
 * the caller supplies it. `createBetterAuthUser` puts it on `data` in every case, and that is what
 * this reads.
 */
export const signInNewUser = Hooks.afterCreate<'auth'>({
  name: 'signInNewUser',
  feature: 'auth',
  run: async (args) => {
    const { config, event, data } = args;

    if (!event.locals.isAutoSignIn) return args;

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
  }
});
