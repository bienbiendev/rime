#!/usr/bin/env node
import { logger } from '$lib/core/logger/index.server.js';
import chalk from 'chalk';
import { copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { getInvokingPackageManager } from '../util/package-manager.server.js';
import { envProduction, polkaServer } from './templates.js';

const installCommands = {
  pnpm: {
    addDeps: 'pnpm install polka sharp serve-static',
    prodInstall: 'pnpm install --prod',
    runEnv: 'pnpm rime env'
  },
  npm: {
    addDeps: 'npm install polka sharp serve-static',
    prodInstall: 'npm install --omit=dev',
    runEnv: 'npx rime env'
  }
} as const;

export const build = (args: { withDatabase?: boolean; withEnv?: boolean }) => {
  // Delete app folder if it exists
  if (existsSync('./app')) {
    rmSync('./app', { recursive: true, force: true });
  }

  // Build
  mkdirSync('./build', { recursive: true });
  // spawnSync('./node_modules/.bin/vite', ['build'], { stdio: 'inherit' });
  console.log('');

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

  // Create main entry server file
  writeFileSync('./app/index.js', polkaServer);
  logger.info('[✓] polka server created at app/index.js');

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
  const pm = getInvokingPackageManager() === 'pnpm' ? 'pnpm' : 'npm';
  if (!args.withEnv) {
    console.log(
      '    ' +
        installCommands[pm].runEnv +
        ' ' +
        chalk.dim(
          `# next time run \`${pm === 'pnpm' ? 'pnpm' : 'npx'} rime build -e\` to generate the .env file automatically`
        )
    );
  }
  console.log('    ' + installCommands[pm].addDeps);
  console.log('    ' + installCommands[pm].prodInstall);
  console.log('');
  console.log('    node --env-file=.env index.js');
};
