import type { GetRegisterType } from '$lib/index.js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { GenericTable } from './types.server.js';

/**
 * What is left of the auth facade: Better-auth's own database adapter, and the three statements
 * against Better-auth's own tables.
 *
 * Three others lived here — `isSuperAdmin`, `getBetterAuthUserId` and `getUserAttributes`. All
 * three were `select … from <a prototype's table> where <a column> = ?`, which is what `findMany`
 * already is, and all three named a collection called `staff`. They are
 * `core/features/auth/user.server.ts` now, written against `adapter.prototype(slug)` like any
 * other reader, and the slug is a constant in the feature that derives that collection.
 *
 * The rest still reads `auth_users`, `auth_sessions` and `auth_accounts` directly. Those are
 * declared tables now (`FeatureDefinition.tables`) rather than a hand-written template, but core
 * has no handle for a table that is not a prototype — see docs/decoupling-auth.md § 2.2.
 */
const createAuthFacade = (args: {
  db: LibSQLDatabase<GetRegisterType<'Schema'>>;
  schema: GetRegisterType<'Schema'>;
}) => {
  const { db, schema } = args;

  const betterAuthAdapter = drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      ...schema,
      user: schema.authUsers,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications
    }
  });

  const getTable = (name: string) => schema[name as keyof typeof schema] as unknown as GenericTable;

  /**
   * Check whether an auth user exists
   */
  const hasAuthUser = async () => {
    const user = await db.query.authUsers.findFirst();
    return !!user;
  };

  /**
   * Sets an auth user's Better-auth role.
   *
   * Better-auth's own `role` column, not rime's `roles` on the auth collection row — the first
   * user needs the former to pass Better-auth's admin checks.
   */
  const setAuthUserRole = async ({ authUserId, role }: { authUserId: string; role: string }) => {
    const authUsers = getTable('authUsers');
    await db.update(authUsers).set({ role }).where(eq(authUsers.id, authUserId));
  };

  /**
   * Removes an auth user and everything hanging off it.
   *
   * Sessions and accounts first, then the user: they reference it, and nothing here relies on a
   * cascade. Used to undo a half-made signup, so it must not leave a session behind that would
   * still authenticate.
   */
  const deleteAuthUser = async ({ authUserId }: { authUserId: string }) => {
    const authSessions = getTable('authSessions');
    const authAccounts = getTable('authAccounts');
    const authUsers = getTable('authUsers');

    await db.delete(authSessions).where(eq(authSessions.userId, authUserId));
    await db.delete(authAccounts).where(eq(authAccounts.userId, authUserId));
    await db.delete(authUsers).where(eq(authUsers.id, authUserId));
  };

  return {
    betterAuthAdapter,
    hasAuthUser,
    setAuthUserRole,
    deleteAuthUser
  };
};

export default createAuthFacade;
