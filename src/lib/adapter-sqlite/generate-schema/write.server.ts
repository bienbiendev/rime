import cache from '#lib/core/dev/cache.server.js';
import { getPackageManager } from '#lib/core/dev/cli/util/package-manager.server.js';
import { schemaPath } from '#lib/core/dev/constants.server.js';
import { logger } from '#lib/core/logger.server.js';
import type { Dic } from '#lib/util/types.js';
import fs from 'fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { SQLITE_DIRECTORY } from '../constant.js';
import { regenerateDrizzleConfig } from '../drizzle-config.server.js';

/** How each package manager runs drizzle-kit. */
const DRIZZLE_KIT: Record<string, string[]> = {
  npm: ['npx', 'drizzle-kit'],
  yarn: ['npx', 'drizzle-kit'],
  pnpm: ['pnpm', 'drizzle-kit'],
  bun: ['bun', 'drizzle-kit'],
  deno: ['deno', 'run', '-A', 'npm:drizzle-kit']
};

const write = (schema: string) => {
  // drizzle-kit reads the schema path off drizzle.config.ts: current before anything runs it
  regenerateDrizzleConfig();

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

  const [command, ...prefix] = DRIZZLE_KIT[getPackageManager()];

  // A migrations folder with `meta/_journal.json` is in the pre-1.0 drizzle-kit layout, which kit
  // refuses to read. `drizzle-kit up` converts it in place — files git tracks — before anything
  // below compares folders, so the converted migrations are not taken as new.
  if (fs.existsSync(path.join(migrationsDir(), 'meta', '_journal.json'))) {
    logger.debug('Migrations folder predates drizzle 1.0 — converting with `drizzle-kit up`.');
    const upResult = spawnSync(command, [...prefix, 'up'], { stdio: 'inherit' });
    if (upResult.error || upResult.status !== 0) {
      throw new Error('drizzle-kit up failed — the migrations folder could not be converted');
    }
  }

  // What to put back if a migration that loses data is refused below.
  const migrationsBefore = new Set(listMigrations());
  const previousSchema = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : null;

  try {
    fs.writeFileSync(outputFile, schema);
  } catch (err: any) {
    throw new Error(`Error writing schema: ${err.message}`);
  }

  logger.debug(`[✓] Schema: generated at ${outputFile}`);

  console.log(`\n ⚡︎ ${[command, ...prefix].join(' ')} generate \n`);
  const generateResult = spawnSync(command, [...prefix, 'generate'], { stdio: 'inherit' });
  if (generateResult.error || generateResult.status !== 0) {
    throw new Error('drizzle-kit generate failed');
  }

  // drizzle-kit applies whatever it generated, a dropped table included. A migration that loses
  // data waits for a yes; without one nothing is applied and the boot stops.
  const created = listMigrations().filter((name) => !migrationsBefore.has(name));
  // A rebuilt table loses the columns it leaves out of the copy: compared with the newest
  // migration from before
  const previous = snapshotOf([...migrationsBefore].sort().at(-1));
  const losses = created.flatMap((name) => {
    const sql = fs.readFileSync(path.join(migrationsDir(), name, 'migration.sql'), 'utf8');
    const after = snapshotOf(name);
    return [...dataLoss(sql), ...(previous && after ? rebuildLoss(sql, previous, after) : [])];
  });
  if (losses.length) {
    const question = `\n ⚠︎ This migration will lose data:\n   ${losses.join('\n   ')}\n Continue? [y/N] `;
    if (!confirm(question)) {
      for (const name of created) {
        fs.rmSync(path.join(migrationsDir(), name), { recursive: true, force: true });
      }
      if (previousSchema === null) fs.rmSync(outputFile, { force: true });
      else fs.writeFileSync(outputFile, previousSchema);
      throw new Error(
        `Migration cancelled: it would lose data. ${SQLITE_DIRECTORY}/ and the schema are left as they were.`
      );
    }
  }

  console.log(`\n ⚡︎ ${[command, ...prefix].join(' ')} migrate \n`);
  const migrateResult = spawnSync(command, [...prefix, 'migrate'], { stdio: 'inherit' });
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
const migrationsDir = () => path.resolve(process.cwd(), SQLITE_DIRECTORY);

/** The migration folders, by name: `20261001194217_dazzling_wallflower`. */
const listMigrations = () => {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => fs.existsSync(path.join(dir, name, 'migration.sql')));
};

/** The snapshot drizzle-kit wrote beside a migration, when there is one. */
const snapshotOf = (name?: string): Snapshot | undefined => {
  if (!name) return undefined;
  const file = path.join(migrationsDir(), name, 'snapshot.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
};

/**
 * A drizzle-kit snapshot: each column is `{ entityType: 'columns', table, name }`, and each rename
 * the migration made is `'pages.title->pages.heading'`.
 */
type Snapshot = { ddl: Dic[]; renames?: string[] };

/** `table.column` of every column in a snapshot. */
const columnsOf = (snapshot: Snapshot) =>
  new Set(
    snapshot.ddl
      .filter((entity) => entity.entityType === 'columns')
      .map((entity) => `${entity.table}.${entity.name}`)
  );

/**
 * The columns of the tables a migration rebuilds that the new snapshot no longer has, a renamed
 * one aside. A rebuild drops such a column by leaving it out of the copy, with no `DROP COLUMN`.
 *
 * ```ts
 * rebuildLoss(sql, before, after) // ['column pages.summary (table rebuilt)']
 * ```
 */
export const rebuildLoss = (sql: string, before: Snapshot, after: Snapshot) => {
  const rebuilt = new Set(
    [...sql.matchAll(/ALTER TABLE `__new_([^`]+)` RENAME TO/g)].map((match) => match[1])
  );
  const kept = columnsOf(after);
  const renamed = new Set((after.renames ?? []).map((rename) => rename.split('->')[0]));
  return [...columnsOf(before)]
    .filter(
      (column) => rebuilt.has(column.split('.')[0]) && !kept.has(column) && !renamed.has(column)
    )
    .map((column) => `column ${column} (table rebuilt)`);
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
