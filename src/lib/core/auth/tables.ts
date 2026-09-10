import type { ColumnDeclaration, TableDeclaration } from '$lib/core/adapter.js';

/**
 * The storage auth needs, said by auth.
 *
 * These four tables were a string constant in `adapter-sqlite/generate-schema/templates.server.ts`,
 * pushed onto every schema whether or not anything signed in; the api-key table was a fifth behind
 * a `authConfig(prototype)?.type === 'apiKey'` sniff in the generator; and the column below was
 * `templateHasAuth`, which decided whether to add the super-admin flag by testing
 * `slug === 'staff'`. All of it was the database layer knowing what auth is.
 *
 * The column order is the order those templates emitted, and it is load-bearing: field order is
 * column order, so a reorder is a migration nobody asked for (`CONTRIBUTING.md`, rule 2).
 */

/**
 * The collection auth derives for panel sign-in.
 *
 * The literal was in the schema generator, which is what made the database layer know a `staff`
 * collection exists and is the one with a super-admin flag. It is auth's, because auth is what
 * creates it — see `staff/configure.ts`.
 */
export const STAFF_SLUG = 'staff';

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

  // Nothing signs in, so none of this is needed. The generator used to emit all four regardless.
  // In practice `configure` derives the staff collection for every config, so this is true today
  // only for a build that has dropped it — which is exactly when emitting them would be wrong.
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

  // The api-key store, when any collection asks for that kind of auth. Its slug has no camel hump
  // on purpose: better-auth's api-key plugin looks the table up as `apikey`.
  if (
    collections.some(
      (collection) =>
        !!collection.auth &&
        typeof collection.auth === 'object' &&
        (collection.auth as { type?: string }).type === 'apiKey'
    )
  ) {
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
 * What a collection that signs in carries on its own row.
 *
 * The link to the better-auth user, and — on the collection auth itself derived — the super-admin
 * flag. `templateHasAuth` decided the second by testing `slug === 'staff'`; the feature that made
 * that collection is the thing that knows which it is.
 */
export const authColumns = (config: { slug: string; auth?: unknown }): ColumnDeclaration[] =>
  // Not an auth collection: no link, no flag. `enabled` used to gate this through a
  // `FeatureDefinition.columns` seam only auth ever implemented.
  !config.auth
    ? []
    : [
        { name: 'authUserId', type: 'text', notNull: true, references: authUserRef },
        ...(config.slug === STAFF_SLUG
          ? [{ name: 'isSuperAdmin', type: 'boolean' } as ColumnDeclaration]
          : [])
      ];
