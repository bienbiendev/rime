import { Hooks } from '$rime/config';
import { RimeError } from '#lib/core/errors/index.js';

/**
 * A create sent with `?throw=after-auth` fails after rime made the better-auth user and before
 * the insert. api.test.ts checks that the user is removed again.
 */
const throwAfterAuth = Hooks.beforeCreate<'users'>(async (args) => {
  if (args.event?.url.searchParams.get('throw') === 'after-auth') {
    throw new RimeError(RimeError.BAD_REQUEST, 'probe: failed after the better-auth user');
  }
  return args;
});

export const hooks = {
  beforeCreate: [throwAfterAuth]
};
