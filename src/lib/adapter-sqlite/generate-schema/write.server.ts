import cache from '$lib/core/dev/cache.server.js';
import { getPackageManager } from '$lib/core/dev/cli/util/package-manager.server.js';
import { schemaPath } from '$lib/core/dev/constants.server.js';
import { logger } from '$lib/core/logger.server.js';
import fs from 'fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const write = (schema: string) => {
  const outputFile = schemaPath();
  // The output path is part of what "unchanged" means here, not just the schema string — a
  // RIME_CONFIG_DIR change can leave the schema content byte-identical while the file it needs
  // to land at moves, and drizzle-kit still needs to re-run against the new location.
  const cacheValue = `${outputFile}\n${schema}`;

  if (cache.matches('schema', cacheValue)) {
    return;
  }

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // What to put back if a migration that loses data is refused below.
  const migrationsBefore = new Set(listMigrations());
  const previousSchema = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : null;

  try {
    fs.writeFileSync(outputFile, schema);
  } catch (err: any) {
    throw new Error(`Error writing schema: ${err.message}`);
  }

  const pm = getPackageManager();
  const commandMap = {
    npm: 'npx',
    pnpm: 'pnpm',
    bun: 'bun',
    yarn: 'npx',
    deno: 'npx'
  };
  const command = commandMap[pm];

  logger.info(`[✓] Schema: generated at ${outputFile}`);

  // Drizzle 1.0 restructured the migrations folder: `meta/_journal.json` is gone and each
  // migration's snapshot moved beside its SQL. Kit refuses to read the old shape at all, so an
  // app whose `db/` predates the upgrade cannot generate or migrate until it is converted.
  //
  // Converted here rather than left to the app, because rime is what runs kit — the alternative
  // is a first `rime dev` after upgrading that fails on a message about a command the app never
  // calls itself. Said out loud, because it rewrites files git is tracking.
  if (fs.existsSync(path.resolve(process.cwd(), 'db', 'meta', '_journal.json'))) {
    logger.info('Migrations folder predates drizzle 1.0 — converting with `drizzle-kit up`.');
    const upResult = spawnSync(command, ['drizzle-kit', 'up'], { stdio: 'inherit' });
    if (upResult.error || upResult.status !== 0) {
      throw new Error('drizzle-kit up failed — the migrations folder could not be converted');
    }
  }

  console.log(`\n ⚡︎ ${command} drizzle-kit generate \n`);
  const generateResult = spawnSync(command, ['drizzle-kit', 'generate'], { stdio: 'inherit' });
  if (generateResult.error || generateResult.status !== 0) {
    throw new Error('drizzle-kit generate failed');
  }

  // drizzle-kit applies whatever it generated, a dropped table included. A migration that loses
  // data waits for a yes; without one nothing is applied and the boot stops.
  const created = listMigrations().filter((name) => !migrationsBefore.has(name));
  const losses = created.flatMap((name) =>
    dataLoss(fs.readFileSync(path.join(migrationsDir(), name, 'migration.sql'), 'utf8'))
  );
  if (losses.length) {
    const question = `\n ⚠︎ This migration will lose data:\n   ${losses.join('\n   ')}\n Continue? [y/N] `;
    if (!confirm(question)) {
      for (const name of created) {
        fs.rmSync(path.join(migrationsDir(), name), { recursive: true, force: true });
      }
      if (previousSchema === null) fs.rmSync(outputFile, { force: true });
      else fs.writeFileSync(outputFile, previousSchema);
      // The next boot asks again, rather than taking this config as already generated.
      cache.delete('config');
      throw new Error(
        'Migration cancelled: it would lose data. db/ and the schema are left as they were.'
      );
    }
  }

  console.log(`\n ⚡︎ ${command} drizzle-kit migrate \n`);
  const migrateResult = spawnSync(command, ['drizzle-kit', 'migrate'], { stdio: 'inherit' });
  if (migrateResult.error || migrateResult.status !== 0) {
    throw new Error('drizzle-kit migrate failed');
  }
  console.log('\n');
  // Only mark the schema as in sync once generate + migrate both actually
  // succeeded — otherwise a future run with an unchanged schema string would
  // skip re-running drizzle-kit and the DB would stay silently out of sync.
  cache.remember('schema', cacheValue);
};

export default write;

/** Where drizzle-kit writes migrations: `out` in the drizzle.config.ts rime generates. */
const migrationsDir = () => path.resolve(process.cwd(), 'db');

/** The migration folders, by name: `20261001194217_dazzling_wallflower`. */
const listMigrations = () => {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => fs.existsSync(path.join(dir, name, 'migration.sql')));
};

/**
 * The statements of a migration that lose data: a dropped table, a dropped column.
 *
 * Not every `DROP TABLE` does. SQLite cannot change a column in place, so drizzle-kit rebuilds
 * the table: it creates `__new_pages`, copies every row into it, drops `pages`, and renames
 * `__new_pages` to `pages`. That drop keeps the rows, and is left out.
 */
export const dataLoss = (sql: string) => {
  const rebuilt = new Set(
    [...sql.matchAll(/ALTER TABLE `__new_([^`]+)` RENAME TO/g)].map((match) => match[1])
  );
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => {
      const dropped = /^DROP TABLE `([^`]+)`/.exec(statement)?.[1];
      if (dropped) return !rebuilt.has(dropped);
      return /^ALTER TABLE `[^`]+` DROP COLUMN/.test(statement);
    });
};

/**
 * A yes or no on the terminal, asked in a child that owns stdin, the way drizzle-kit's own
 * prompts are. No terminal (CI, a test run) answers no.
 */
export const confirm = (question: string) => {
  if (!process.stdin.isTTY) return false;
  const ask = `process.stdout.write(${JSON.stringify(question)});process.stdin.once('data',(d)=>process.exit(/^y(es)?$/i.test(String(d).trim())?0:1))`;
  return spawnSync(process.execPath, ['-e', ask], { stdio: 'inherit' }).status === 0;
};
