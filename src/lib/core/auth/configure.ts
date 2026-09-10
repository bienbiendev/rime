import type { TableDeclaration } from '$lib/core/adapter.js';
import type { Dic } from '$lib/util/types.js';
import { authTables } from './tables.js';

/**
 * Puts the tables no prototype declares on `config.$tables`: better-auth's four, plus the api-key
 * store when a collection asks for that kind of auth.
 *
 * It appends, so a later step can add its own. A consumer wiring a better-auth plugin declares
 * that plugin's table the same way:
 *
 * ```ts
 * configure: (config) => ({
 *   ...config,
 *   $tables: [...config.$tables, { slug: 'authTwoFactor', columns: [ … ] }]
 * })
 * ```
 *
 * Runs after `configureStaff`, which is what puts an `auth` collection in the config.
 */
export const configureAuthTables = <T extends Dic>(
  config: T
): T & { $tables: TableDeclaration[] } => ({
  ...config,
  $tables: [...((config.$tables as TableDeclaration[] | undefined) ?? []), ...authTables(config)]
});
