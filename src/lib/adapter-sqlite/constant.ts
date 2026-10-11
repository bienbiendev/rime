/**
 * Where the SQLite database and its migrations live, from the app root. Under `storage/`, which
 * no URL reaches.
 *
 * ```
 * storage/sqlite/app.sqlite
 * storage/sqlite/20261001194217_dazzling_wallflower/migration.sql
 * ```
 */
export const SQLITE_DIRECTORY = 'storage/sqlite';

/** drizzle-kit's config, at the project root. */
export const DRIZZLE_CONFIG = 'drizzle.config.ts';

/** The folder `rime db:move` moves to `SQLITE_DIRECTORY`. */
export const DB_MOVE_SOURCE = 'db';

/** The package entry of the adapter's hooks, `AdapterHooks.module`. */
export const HOOKS_MODULE = 'rimecms/adapter-sqlite/hooks';
