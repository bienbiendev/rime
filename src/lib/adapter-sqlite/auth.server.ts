import type { GetRegisterType } from '$lib/index.js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

/**
 * All that is left of the auth facade: Better-auth's own database adapter.
 *
 * It stays because it cannot be phrased in core's vocabulary and should not be — core hands it to
 * Better-auth and never looks inside. The other six methods went two ways. Three were
 * `select … from <a prototype's table> where <a column> = ?` and are
 * `core/features/auth/user.server.ts` now; three read and wrote Better-auth's own tables and are
 * `core/features/auth/better-auth-tables.server.ts`, reaching them through `adapter.table(slug)`
 * because those are declared tables rather than a hand-written template.
 */
const createAuthHandle = (args: {
  db: LibSQLDatabase<GetRegisterType<'Relations'>>;
  schema: GetRegisterType<'Schema'>;
}) => {
  const { db, schema } = args;

  return {
    betterAuthAdapter: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        ...schema,
        user: schema.authUsers,
        session: schema.authSessions,
        account: schema.authAccounts,
        verification: schema.authVerifications
      }
    })
  };
};

export default createAuthHandle;
