#!/usr/bin/env node
import { logger } from '$lib/core/logger/index.server.js';
import { program } from 'commander';
import { existsSync, writeFileSync } from 'fs';
import { envProduction } from './build/templates.js';

program.version('0.1').description('CMS utilities');

program.description('Rime utilities');

program
  .command('init')
  .option('-n, --name <name>', 'Will be the database name')
  .option('-f, --force', 'Force init with default package name', false)
  .option('-s, --skip-install', 'Do not install dependencies', false)
  .action(async (args) => {
    const init = await import('./init/index.server.js').then((m) => m.init);
    init(args);
  });

program
  .command('build')
  .option('-d, --with-database', 'Include database', false)
  .option('-e, --with-env', 'Create the /app/.env file from the production template', false)
  .action(async (args) => {
    const build = await import('./build/index.js').then((m) => m.build);
    build(args);
  });

program
  .command('clear')
  .option('-f, --force', 'Force clear without prompt', false)
  .action(async (args) => {
    const clear = await import('./clear/index.server.js').then((m) => m.clear);
    clear(args);
  });

program
  .command('generate')
  .option('-f, --force', 'Force generation, ignore cache, overwrite routes', false)
  .action(async (args) => {
    const generate = await import('./generate/index.server.js').then((m) => m.generate);
    try {
      await generate({
        force: args.force
      });
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command('env')
  .option('-f, --force', 'Force generation, overwrite current', false)
  .action(async (args) => {
    try {
      if (existsSync('./.env') && !args.force) {
        logger.info('.env file already exists. Use --force to overwrite.');
        return;
      }
      writeFileSync('./.env', envProduction());
      logger.info('[✓] .env file created');
    } catch {
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
