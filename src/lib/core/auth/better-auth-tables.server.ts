import type { Adapter } from '#lib/core/adapter.js';

/**
 * The reads and writes auth makes against Better-auth's own tables, through `adapter.table(slug)`.
 *
 * **Better-auth's own API would check permissions again**, with rules that differ from rime's:
 * `listUsers`, `setRole` and `removeUser` sit behind `adminMiddleware`, and `deleteApiKey` lets
 * only the key's creator delete it. Each function here runs once rime's access has allowed the
 * change, or where no session exists — see each function.
 */

const USERS = '$authUsers';
const SESSIONS = '$authSessions';
const ACCOUNTS = '$authAccounts';
const API_KEYS = '$apikey';

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
 * A better-auth user's own role, `admin`, `staff` or `user`, or `null` when no user has that id.
 * Read for the user who made an api key: their role decides whether the key's `admin` counts.
 */
export const authUserRole = async (
  adapter: Adapter,
  args: { authUserId: string }
): Promise<string | null> => {
  const [row] = await adapter.table(USERS).find({
    where: { id: args.authUserId },
    select: ['role'],
    limit: 1
  });
  return (row?.role as string | undefined) ?? null;
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
 * cascade. No session is left behind that would still authenticate.
 *
 * Used to undo a half-made signup and after an auth document is deleted. Better-auth's
 * `removeUser` refuses both when the caller is the user being removed
 * (`YOU_CANNOT_REMOVE_YOURSELF`), and refuses any caller without its `user: ['delete']` statement.
 */
export const deleteAuthUser = async (
  adapter: Adapter,
  args: { authUserId: string }
): Promise<void> => {
  await adapter.table(SESSIONS).delete({ where: { userId: args.authUserId } });
  await adapter.table(ACCOUNTS).delete({ where: { userId: args.authUserId } });
  await adapter.table(USERS).delete({ where: { id: args.authUserId } });
};

/**
 * Removes an api key, whoever created it. Better-auth's `deleteApiKey` lets only the key's creator
 * do that.
 */
export const deleteAuthApiKey = async (
  adapter: Adapter,
  args: { apiKeyId: string }
): Promise<void> => {
  await adapter.table(API_KEYS).delete({ where: { id: args.apiKeyId } });
};
