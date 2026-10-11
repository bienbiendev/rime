import { logger } from '#lib/core/logger.server.js';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { DB_MOVE_SOURCE, DRIZZLE_CONFIG, SQLITE_DIRECTORY } from './constant.js';

/**
 * A string that names the old folder, in any quotes: `'./db'`, `'db'`, `'./db/app.sqlite'`,
 * `'db/app.sqlite'`, `'file:./db/app.sqlite'`. Not `'./dbx'` nor `'./data/db.sqlite'`. Its groups:
 * the quote, `file:`, `./`, and the rest of the path.
 */
const SOURCE_STRING = /(['"`])(file:)?(\.\/)?db((?:\/[^'"`]*)?)\1/g;

/** Whether a drizzle config's content still names the old folder. */
export const namesSourceFolder = (content: string) =>
  new RegExp(SOURCE_STRING.source).test(content);

/** Whether the project's `drizzle.config.ts` still names the old folder. */
export const drizzleConfigNamesSource = (root: string) => {
  const file = path.join(root, DRIZZLE_CONFIG);
  return existsSync(file) && namesSourceFolder(readFileSync(file, 'utf-8'));
};

/** A `.gitignore` line that keeps all of `storage/` out of git: `/storage`, `storage/`, … */
const IGNORES_STORAGE = /^\/?storage\/?[ \t]*$/m;

/**
 * Moves `db/` to `storage/sqlite/`. `false` when there is no `db/`, so a second run moves nothing.
 * An empty `storage/sqlite/` counts as absent. One holding a file throws, and nothing moves.
 */
export const moveDatabaseFolder = (root: string) => {
  const from = path.join(root, DB_MOVE_SOURCE);
  const to = path.join(root, SQLITE_DIRECTORY);
  if (!existsSync(from)) return false;

  if (existsSync(to)) {
    if (readdirSync(to).length) {
      throw new Error(
        `Both ${DB_MOVE_SOURCE}/ and ${SQLITE_DIRECTORY}/ hold files: keep one, then run again`
      );
    }
    rmdirSync(to);
  }
  mkdirSync(path.dirname(to), { recursive: true });
  renameSync(from, to);
  return true;
};

/**
 * Points the paths of `drizzle.config.ts` that name the old folder at `storage/sqlite`, and
 * answers each change. `[]` when the file is missing or names none.
 *
 * ```ts
 * out: './db',                 // -> out: './storage/sqlite',
 * url: 'file:./db/app.sqlite'  // -> url: 'file:./storage/sqlite/app.sqlite'
 * moveDrizzlePaths(root)       // ["'./db' -> './storage/sqlite'", …]
 * ```
 */
export const moveDrizzlePaths = (root: string) => {
  const file = path.join(root, DRIZZLE_CONFIG);
  if (!existsSync(file)) return [];
  const changes: string[] = [];
  const content = readFileSync(file, 'utf-8');
  const next = content.replace(SOURCE_STRING, (whole, quote, scheme = '', dot = '', rest) => {
    const moved = `${quote}${scheme}${dot}${SQLITE_DIRECTORY}${rest}${quote}`;
    changes.push(`${whole} -> ${moved}`);
    return moved;
  });
  if (changes.length) {
    writeFileSync(file, next);
  }
  return changes;
};

/**
 * Adds `/storage` to `.gitignore` when no line there covers the whole folder. `false` when one
 * does, or when there is no `.gitignore`.
 */
export const ignoreStorage = (root: string) => {
  const file = path.join(root, '.gitignore');
  if (!existsSync(file)) return false;
  const content = readFileSync(file, 'utf-8');
  if (IGNORES_STORAGE.test(content)) return false;
  writeFileSync(file, `${content.trimEnd()}\n/storage\n`);
  return true;
};

/**
 * `rime db:move`: moves the database folder, then points `drizzle.config.ts` at it, then makes
 * `.gitignore` cover `storage/`. Loads no config and opens no database, so it runs in a deployed
 * `app/` too.
 */
export const dbMove = () => {
  const root = process.cwd();
  try {
    logger.debug(
      moveDatabaseFolder(root)
        ? `[✓] ${DB_MOVE_SOURCE}/ moved to ${SQLITE_DIRECTORY}/`
        : `[✓] No ${DB_MOVE_SOURCE}/ to move (skip)`
    );
    const changes = moveDrizzlePaths(root);
    logger.debug(
      changes.length
        ? `[✓] ${DRIZZLE_CONFIG}: ${changes.join(', ')}`
        : `[✓] ${DRIZZLE_CONFIG} names no ${DB_MOVE_SOURCE}/ path, or there is none (skip)`
    );
    logger.debug(
      ignoreStorage(root)
        ? '[✓] /storage added to .gitignore'
        : '[✓] .gitignore already covers storage/, or there is none (skip)'
    );
  } catch (error) {
    logger.error('[✗] Error while moving the database:', error);
    throw error;
  }
};
