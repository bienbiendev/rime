import type { Adapter } from '$lib/core/adapter.js';

/**
 * The three writes and one read auth makes against Better-auth's own tables, through
 * `adapter.table(slug)`.
 *
 * **Better-auth's admin API cannot do any of this.** `listUsers`, `setRole` and `removeUser` all
 * sit behind `adminMiddleware`, and every caller here runs where no admin session exists — see
 * each function.
 */

const USERS = '$authUsers';
const SESSIONS = '$authSessions';
const ACCOUNTS = '$authAccounts';

/**
 * Whether anybody has signed up yet.
 *
 * Gates the init route, so it is asked precisely when the answer is expected to be no — which is
 * why Better-auth's `listUsers` cannot serve it: there is no admin session to authorize with.
 */
export const hasAuthUser = async (adapter: Adapter): Promise<boolean> => {
  const rows = await adapter.table(USERS).find({ select: ['id'], limit: 1 });
  return rows.length > 0;
};

/**
 * Sets an auth user's Better-auth role.
 *
 * Better-auth's own `role` column, not rime's `roles` on the auth collection row — the first user
 * needs the former to pass Better-auth's admin checks. Which is also why `setRole` cannot serve
 * it: this call is what makes the first admin, so `adminMiddleware` has nobody to accept yet.
 */
export const setAuthUserRole = async (
  adapter: Adapter,
  args: { authUserId: string; role: string }
): Promise<void> => {
  await adapter.table(USERS).update({
    where: { id: args.authUserId },
    data: { role: args.role }
  });
};

/**
 * Removes an auth user and everything hanging off it.
 *
 * Sessions and accounts first, then the user: they reference it, and nothing here relies on a
 * cascade. Used to undo a half-made signup, so it must not leave a session behind that would
 * still authenticate.
 *
 * Better-auth's `removeUser` deletes sessions first too, but it refuses this case outright —
 * `YOU_CANNOT_REMOVE_YOURSELF`, and the half-made signup being rolled back is exactly the session
 * making the request.
 */
export const deleteAuthUser = async (
  adapter: Adapter,
  args: { authUserId: string }
): Promise<void> => {
  await adapter.table(SESSIONS).delete({ where: { userId: args.authUserId } });
  await adapter.table(ACCOUNTS).delete({ where: { userId: args.authUserId } });
  await adapter.table(USERS).delete({ where: { id: args.authUserId } });
};
