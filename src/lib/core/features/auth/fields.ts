import { email } from '$lib/fields/email/index.js';
import { text } from '$lib/fields/text/index.js';

/**
 * The auth fields that belong on a *config* — which is to say, the ones a client build may see.
 *
 * This file is isomorphic: `module.ts`'s `augmentAuth` runs on both sides, so everything here ends
 * up in the client's built config. That is the whole reason `password` is not in it any more — it
 * lives in `fields.server.ts`, beside the hook that appends it, because a password field is
 * something the server adds at write time and never something a config declares.
 *
 * `roles` was here too and nothing read it: `augmentAuth` builds its own, per collection, because
 * the options and the access rules differ between `staff` and a user collection.
 */

const emailField = email('email')
  .access({
    create: () => true,
    read: (user) => !!user,
    update: () => false
  })
  .required()
  .unique();

const name = text('name')
  .access({
    create: () => true,
    read: (user) => !!user,
    update: () => false
  })
  .required();

export const usersFields = {
  email: emailField,
  name
};
