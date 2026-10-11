import type { GetRegisterType } from '#lib/index.js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { SqliteDatabase } from './types.server.js';

/**
 * Better-auth's own database adapter, over the generated schema. Core hands it to Better-auth and
 * never looks inside.
 */
const createAuthHandle = (args: { db: SqliteDatabase; schema: GetRegisterType<'Schema'> }) => {
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
