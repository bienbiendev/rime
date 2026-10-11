import { STAFF_SLUG } from './constant.js';
import type { ColumnDeclaration, TableDeclaration } from '#lib/core/adapter.js';

/**
 * The storage auth needs. Column order is load-bearing: field order is column order, so a
 * reorder is a migration.
 */

const timestampsMs: ColumnDeclaration[] = [
  { name: 'createdAt', type: 'timestampMs', notNull: true },
  { name: 'updatedAt', type: 'timestampMs', notNull: true }
];

/** A foreign key onto the better-auth user, which three of the tables below carry. */
const authUserRef = {
  table: '$authUsers',
  onDelete: 'cascade'
} as const;

export const authTables = (config: {
  collections?: { auth?: unknown; slug: string }[];
}): TableDeclaration[] => {
  const collections = config.collections ?? [];

  // Nothing signs in, so no auth table is needed.
  if (!collections.some((collection) => collection.auth)) return [];

  const tables: TableDeclaration[] = [
    {
      slug: '$authUsers',
      columns: [
        { name: 'id', type: 'text', primary: true },
        { name: 'name', type: 'text', notNull: true },
        { name: 'email', type: 'text', notNull: true, unique: true },
        { name: 'emailVerified', type: 'boolean', notNull: true },
        { name: 'image', type: 'text' },
        ...timestampsMs,
        { name: 'role', type: 'text' },
        { name: 'banned', type: 'boolean' },
        { name: 'banReason', type: 'text' },
        { name: 'banExpires', type: 'timestampMs' },
        { name: 'type', type: 'text', notNull: true }
      ]
    },
    {
      slug: '$authSessions',
      columns: [
        { name: 'id', type: 'text', primary: true },
        { name: 'expiresAt', type: 'timestampMs', notNull: true },
        { name: 'token', type: 'text', notNull: true, unique: true },
        ...timestampsMs,
        { name: 'ipAddress', type: 'text' },
        { name: 'userAgent', type: 'text' },
        { name: 'userId', type: 'text', notNull: true, references: authUserRef },
        { name: 'impersonatedBy', type: 'text' }
      ]
    },
    {
      slug: '$authAccounts',
      columns: [
        { name: 'id', type: 'text', primary: true },
        { name: 'accountId', type: 'text', notNull: true },
        { name: 'providerId', type: 'text', notNull: true },
        { name: 'userId', type: 'text', notNull: true, references: authUserRef },
        { name: 'accessToken', type: 'text' },
        { name: 'refreshToken', type: 'text' },
        { name: 'idToken', type: 'text' },
        { name: 'accessTokenExpiresAt', type: 'timestampMs' },
        { name: 'refreshTokenExpiresAt', type: 'timestampMs' },
        { name: 'scope', type: 'text' },
        { name: 'password', type: 'text' },
        ...timestampsMs
      ]
    },
    {
      slug: '$authVerifications',
      columns: [
        { name: 'id', type: 'text', primary: true },
        { name: 'identifier', type: 'text', notNull: true },
        { name: 'value', type: 'text', notNull: true },
        { name: 'expiresAt', type: 'timestampMs', notNull: true },
        { name: 'createdAt', type: 'timestampMs' },
        { name: 'updatedAt', type: 'timestampMs' }
      ]
    }
  ];

  // The api-key store. Unconditional, because `configurePlugins` registers better-auth's api-key
  // plugin unconditionally, and 1.7.4 checks at startup that every registered plugin has its
  // table:
  //
  // ```
  // ERROR [Better Auth]: Drizzle schema mismatch
  //   Missing tables
  //     apikey
  // ```
  //
  // Making the *plugin* conditional instead would make `rime.auth`'s inferred type depend on
  // whether a config happens to declare an apiKey collection. Its slug has no camel hump on
  // purpose: the plugin looks the table up as `apikey`.
  {
    tables.push({
      slug: '$apikey',
      columns: [
        { name: 'id', type: 'text', primary: true },
        { name: 'name', type: 'text' },
        { name: 'start', type: 'text' },
        { name: 'prefix', type: 'text' },
        { name: 'key', type: 'text', notNull: true },
        { name: 'referenceId', type: 'text', notNull: true, references: authUserRef },
        { name: 'configId', type: 'text', notNull: true, defaultValue: 'default' },
        { name: 'refillInterval', type: 'integer' },
        { name: 'refillAmount', type: 'integer' },
        { name: 'lastRefillAt', type: 'timestamp' },
        { name: 'enabled', type: 'boolean', defaultValue: true },
        { name: 'rateLimitEnabled', type: 'boolean', defaultValue: true },
        { name: 'rateLimitTimeWindow', type: 'integer', defaultValue: 86400000 },
        { name: 'rateLimitMax', type: 'integer', defaultValue: 10 },
        { name: 'requestCount', type: 'integer' },
        { name: 'remaining', type: 'integer' },
        { name: 'lastRequest', type: 'timestamp' },
        { name: 'expiresAt', type: 'timestamp' },
        { name: 'createdAt', type: 'timestamp', notNull: true },
        { name: 'updatedAt', type: 'timestamp', notNull: true },
        { name: 'permissions', type: 'text' },
        { name: 'metadata', type: 'text' }
      ]
    });
  }

  return tables;
};

/**
 * What a collection that signs in carries on its own row: the link to the better-auth user, and,
 * on the staff collection auth derives, the super-admin flag.
 */
export const authColumns = (config: { slug: string; auth?: unknown }): ColumnDeclaration[] =>
  // Not an auth collection: no link, no flag.
  !config.auth
    ? []
    : [
        { name: 'authUserId', type: 'text', notNull: true, references: authUserRef },
        ...(config.slug === STAFF_SLUG
          ? [{ name: 'isSuperAdmin', type: 'boolean' } as ColumnDeclaration]
          : [])
      ];
