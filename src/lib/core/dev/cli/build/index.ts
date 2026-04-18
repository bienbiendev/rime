#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { polkaServer } from './templates.js';
import { logger } from '$lib/core/logger/index.server.js';

export const build = (args: { withDatabase?: boolean }) => {
  // Delete app folder if it exists
  if (existsSync('./app')) {
    rmSync('./app', { recursive: true, force: true });
  }
  // Build
  spawnSync('./node_modules/.bin/vite', ['build'], { stdio: 'inherit' });
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
  writeFileSync('./app/index.js', polkaServer);
  logger.info('[✓] polka server created at app/index.js');
  console.log('');
  logger.info('Next steps :');
  logger.info('create a /app/.env file with ORIGIN HOST and PORT variables');
  logger.info('cd ./app');
  logger.info('pnpm install --prod');
  logger.info('pnpm install polka sharp serve-static');
  logger.info('node --env-file=.env index.js');
};
