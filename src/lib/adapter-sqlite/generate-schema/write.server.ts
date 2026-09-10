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
  const cachedSchema = cache.get('schema');

  if (cachedSchema && cachedSchema === cacheValue) {
    return;
  }

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

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
  console.log(`\n ⚡︎ ${command} drizzle-kit migrate \n`);
  const migrateResult = spawnSync(command, ['drizzle-kit', 'migrate'], { stdio: 'inherit' });
  if (migrateResult.error || migrateResult.status !== 0) {
    throw new Error('drizzle-kit migrate failed');
  }
  console.log('\n');
  // Only mark the schema as in sync once generate + migrate both actually
  // succeeded — otherwise a future run with an unchanged schema string would
  // skip re-running drizzle-kit and the DB would stay silently out of sync.
  cache.set('schema', cacheValue);
};

export default write;
