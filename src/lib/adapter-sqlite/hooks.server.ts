import type { AdapterHooks } from '#lib/core/adapter.js';
import { logger } from '#lib/core/logger.server.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DB_MOVE_SOURCE, DRIZZLE_CONFIG, HOOKS_MODULE, SQLITE_DIRECTORY } from './constant.js';
import { drizzleConfigNamesSource } from './db-move.server.js';
import { drizzleConfig, regenerateDrizzleConfig } from './drizzle-config.server.js';

/** drizzle-orm and drizzle-kit at the release rime is built against: `@rc` moves. */
const DRIZZLE = '1.0.0-rc.4';

/**
 * Creates `storage/sqlite/` when it is missing. A project from before the move throws, since
 * `rime db:move` moves it: its `drizzle.config.ts` still names `db/`, as in a fresh clone whose
 * `db/` is gitignored, or it holds a `db/` folder and no `storage/sqlite/`.
 */
const ensureDatabaseFolder = (root: string) => {
  const directory = path.join(root, SQLITE_DIRECTORY);
  const notMoved =
    drizzleConfigNamesSource(root) ||
    (!existsSync(directory) && existsSync(path.join(root, DB_MOVE_SOURCE)));
  if (notMoved) {
    throw new Error(
      `The database is in ${DB_MOVE_SOURCE}/: run \`rime db:move\` once to move it to ${SQLITE_DIRECTORY}/`
    );
  }
  if (existsSync(directory)) return;
  mkdirSync(directory, { recursive: true });
  logger.debug(`[✓] ${SQLITE_DIRECTORY} directory created`);
};

/** What the SQLite adapter does to a project in dev and from the CLI. */
export const hooks: AdapterHooks = {
  module: HOOKS_MODULE,

  async init({ name, bun }) {
    const root = process.cwd();
    if (existsSync(path.join(root, DRIZZLE_CONFIG))) {
      logger.debug(
        regenerateDrizzleConfig(root)
          ? '[✓] Drizzle config schema path updated'
          : '[✓] Drizzle config already exists (skip)'
      );
    } else {
      writeFileSync(path.join(root, DRIZZLE_CONFIG), drizzleConfig(name));
      logger.debug('[✓] Drizzle config added');
    }
    ensureDatabaseFolder(root);
    return {
      config: {
        import: "import { adapterSqlite } from 'rimecms/adapter-sqlite';",
        call: `adapterSqlite('${name}.sqlite'${bun ? ", { driver: 'bun' }" : ''})`
      },
      dependencies: [`drizzle-orm@${DRIZZLE}`, '@libsql/client'],
      devDependencies: [`drizzle-kit@${DRIZZLE}`]
    };
  },

  async boot() {
    const root = process.cwd();
    if (!existsSync(path.join(root, DRIZZLE_CONFIG))) {
      throw new Error(`Missing ${DRIZZLE_CONFIG}, did you run rime init`);
    }
    ensureDatabaseFolder(root);
  },

  async clear() {
    const removed = [SQLITE_DIRECTORY, DRIZZLE_CONFIG].filter((entry) => existsSync(entry));
    for (const entry of removed) {
      rmSync(entry, { recursive: true, force: true });
    }
    return removed;
  }
};
