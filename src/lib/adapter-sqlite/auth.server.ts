import type { User } from '$lib/core/features/auth/types.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import type { GetRegisterType } from '$lib/index.js';
import type { Dic } from '$lib/util/types.js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { GenericTable } from './types.server.js';
import { baseTableName } from './naming.server.js';
// import { configureBetterAuth } from './better-auth.server.js';

/**
 * Creates and configures the authentication facade for the SQLite adapter
 * @param args Configuration parameters for the auth facade
 * @returns Object containing all auth-related functions
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

  const isSuperAdmin = async (userId: string) => {
    const panelUsersTable = getTable('staff');
    const [user] = await db
      .select({ isSuperAdmin: panelUsersTable.isSuperAdmin })
      .from(panelUsersTable)
      .where(eq(panelUsersTable.id, userId));
    if (!user) return false;
    return user.isSuperAdmin === true;
  };

  /**
   * Retrieves the BetterAuth user ID from a collection row
   * @returns BetterAuth user ID or null if not found
   */
  const getBetterAuthUserId = async ({ slug, id }: { slug: CollectionSlug; id: string }) => {
    const userTable = getTable(baseTableName(slug));
    // @ts-expect-error slug is key of query
    const user = await db.query[baseTableName(slug)].findFirst({ where: eq(userTable.id, id) });
    if (user) {
      return user.authUserId;
    }
    return null;
  };

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

  /**
   * Retrieves user attributes from an auth collection
   * @returns User object or undefined if not found
   */
  const getUserAttributes = async ({
    authUserId,
    slug
  }: GetUserAttributesArgs): Promise<User | undefined> => {
    const table = getTable(baseTableName(slug));

    const columns: Dic = {
      id: table.id,
      name: table.name,
      roles: table.roles,
      email: table.email
    };

    if (slug === 'staff') {
      columns.isSuperAdmin = table.isSuperAdmin;
    }

    const [user] = await db.select(columns).from(table).where(eq(table.authUserId, authUserId));

    if (!user) return undefined;

    return {
      ...user,
      isStaff: slug === 'staff'
    } as User;
  };

  return {
    betterAuthAdapter,
    hasAuthUser,
    getBetterAuthUserId,
    setAuthUserRole,
    deleteAuthUser,
    getUserAttributes,
    isSuperAdmin
  };
};

export default createAuthFacade;

type GetUserAttributesArgs = {
  authUserId: string;
  slug: CollectionSlug;
};
