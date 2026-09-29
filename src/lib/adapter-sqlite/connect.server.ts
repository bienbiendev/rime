import { building } from '$app/environment';
import { logger } from '$lib/core/logger.server.js';
import type { SqliteDatabase } from './types.server.js';

export type SqliteDriver = 'libsql' | 'bun';

/**
 * Opens the database with the configured driver.
 *
 * Each driver is imported only when chosen, so a Node process never loads `bun:sqlite`.
 */
export async function connect(args: {
  driver: SqliteDriver;
  dbPath: string;
  relations: any;
}): Promise<SqliteDatabase> {
  const { dbPath, relations } = args;
  let driver = args.driver;

  if (driver === 'bun' && !process.versions.bun) {
    // `rime generate`/`init` (bin runs on Node) and `vite build` only need a connection to
    // boot, not a fast one — libsql opens the same file.
    if (!building && !process.env.RIME_CLI) {
      throw new Error(
        "adapterSqlite driver 'bun' needs the Bun runtime — run with `bun --bun vite dev` / `bun index.js`"
      );
    }
    logger.debug("driver 'bun' outside Bun, falling back to libsql");
    driver = 'libsql';
  }

  // `relations` comes untyped from the generated schema module; the casts restore `Relations`.
  if (driver === 'bun') {
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle(dbPath, { relations }) as unknown as SqliteDatabase;
  }

  const { drizzle } = await import('drizzle-orm/libsql');
  return drizzle('file:' + dbPath, { relations }) as unknown as SqliteDatabase;
}
