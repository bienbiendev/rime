#!/usr/bin/env node
import { logger } from '$lib/core/logger.server.js';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs';
import { getInvokingPackageManager, SVELTEKIT_ADAPTER } from '../util/package-manager.server.js';
import { usesBunScripts } from '../util/package.server.js';
import { bunServer, envProduction, nodeServer } from '../templates/build.js';

const installCommands = {
  pnpm: {
    addDeps: 'pnpm install sharp serve-static',
    prodInstall: 'pnpm install --prod',
    runEnv: 'pnpm rime env'
  },
  npm: {
    addDeps: 'npm install sharp serve-static',
    prodInstall: 'npm install --omit=dev',
    runEnv: 'npx rime env'
  },
  // Bun entry serves ./static itself: no serve-static
  bun: {
    addDeps: 'bun add sharp',
    prodInstall: 'bun install --production',
    runEnv: 'bunx rime env'
  }
} as const;

export const build = (args: {
  withDatabase?: boolean;
  withEnv?: boolean;
  withStatic?: boolean;
  bun?: boolean;
}) => {
  const bun = args.bun ?? usesBunScripts();

  // Delete app folder if it exists
  if (existsSync('./app')) {
    rmSync('./app', { recursive: true, force: true });
  }

  // Build
  // --bun: vite (and anything the build imports) runs on Bun, not on its bin's Node shebang
  if (bun) {
    spawnSync('bun', ['--bun', './node_modules/.bin/vite', 'build'], { stdio: 'inherit' });
  } else {
    spawnSync('./node_modules/.bin/vite', ['build'], { stdio: 'inherit' });
  }
  console.log('');

  // The Bun entry wraps svelte-adapter-bun's handler; adapter-node's has no getHandler
  const handler = './build/handler.js';
  if (bun && !(existsSync(handler) && readFileSync(handler, 'utf-8').includes('getHandler'))) {
    logger.error(
      `--bun needs ${SVELTEKIT_ADAPTER.bun} as the SvelteKit adapter (vite.config.ts): run \`rime init --bun\``
    );
    process.exitCode = 1;
    return;
  }

  // Create app directory
  mkdirSync('./app', { recursive: true });

  // Move build folder
  renameSync('./build', './app/build');
  logger.info('[✓] /app folder created');

  // Copy package.json
  copyFileSync('./package.json', './app/package.json');
  logger.info('[✓] package.json copied');

  // Copy db folder if flag is set
  if (args.withDatabase) {
    cpSync('./db', './app/db', { recursive: true });
    logger.info('[✓] database copied');
  }

  // Copy static folder if flag is set
  if (args.withStatic) {
    cpSync('./static', './app/static', { recursive: true });
    logger.info('[✓] static directory copied');
  }

  // Create main entry server file
  writeFileSync('./app/index.js', bun ? bunServer : nodeServer);
  logger.info('[✓] server created at app/index.js');

  // Create .env file if flag is set
  const envContent = envProduction();
  if (args.withEnv) {
    writeFileSync('./app/.env', envContent);
    logger.info('[✓] .env file created at app/.env');
  }

  console.log('----------------------------------------------------------------\n');
  console.log('## Next steps :');
  console.log('');
  console.log('    cd ./app');
  const pm = bun ? 'bun' : getInvokingPackageManager() === 'pnpm' ? 'pnpm' : 'npm';
  // `rime init` already lists sharp; Bun.serve needs no serve-static
  const { dependencies = {} } = JSON.parse(readFileSync('./package.json', 'utf-8'));
  if (!bun || !dependencies.sharp) console.log('    ' + installCommands[pm].addDeps);
  console.log('    ' + installCommands[pm].prodInstall);
  // After the install: before it, `npx rime`/`bunx rime` fetch the unrelated `rime` package
  if (!args.withEnv) {
    console.log(
      '    ' +
        installCommands[pm].runEnv +
        ' ' +
        chalk.dim(
          `# next time run \`${{ pnpm: 'pnpm', npm: 'npx', bun: 'bunx' }[pm]} rime build -e\` to generate the .env file automatically`
        )
    );
  }
  console.log('');
  console.log(bun ? '    bun index.js' : '    node --env-file=.env index.js');
};
