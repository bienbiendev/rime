import cache from '$lib/core/dev/cache/index.server.js';
import { getPackageManager } from '$lib/core/dev/cli/init/package-manager-util.server.js';
import { logger } from '$lib/core/logger/index.server.js';
import fs from 'fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const OUTPUT_DIR = '+rime.generated';

const write = (schema: string) => {
  const cachedSchema = cache.get('schema');

  if (cachedSchema && cachedSchema === schema) {
    return;
  }

  const outputPath = path.join('./src/lib', OUTPUT_DIR);
  const outputFile = path.join(outputPath, 'schema.server.ts');
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
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

  logger.info('[✓] Schema: generated at src/lib/server/schema.ts');
  console.log('============================================================');
  console.log(`\n ⚡︎ ${command} drizzle-kit generate \n`);
  const generateResult = spawnSync(command, ['drizzle-kit', 'generate'], { stdio: 'inherit' });
  if (generateResult.error || generateResult.status !== 0) {
    throw new Error('drizzle-kit generate failed');
  }
  console.log('\n============================================================');
  console.log(`\n ⚡︎ ${command} drizzle-kit migrate \n`);
  const migrateResult = spawnSync(command, ['drizzle-kit', 'migrate'], { stdio: 'inherit' });
  if (migrateResult.error || migrateResult.status !== 0) {
    throw new Error('drizzle-kit migrate failed');
  }
  console.log('\n============================================================');
  // Only mark the schema as in sync once generate + migrate both actually
  // succeeded — otherwise a future run with an unchanged schema string would
  // skip re-running drizzle-kit and the DB would stay silently out of sync.
  cache.set('schema', schema);
};

export default write;
