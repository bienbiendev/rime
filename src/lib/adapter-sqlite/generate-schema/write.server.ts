import cache from '$lib/core/dev/cache/index.js';
import { getPackageManager } from '$lib/core/dev/cli/init/packageManagerUtil';
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
    logger.error('Error writing schema', err.message);
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
  spawnSync(command, ['drizzle-kit', 'generate'], { stdio: 'inherit' });
  console.log('\n============================================================');
  console.log(`\n ⚡︎ ${command} drizzle-kit migrate \n`);
  spawnSync(command, ['drizzle-kit', 'migrate'], { stdio: 'inherit' });
  console.log('\n============================================================');
  cache.set('schema', schema);
};

export default write;
