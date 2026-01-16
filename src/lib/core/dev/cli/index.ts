#!/usr/bin/env node
import { program } from 'commander';

program.version('0.1').description('CMS utilities');

program.description('Rime utilities');

program
	.command('init')
	.option('-n, --name <name>', 'Will be the database name')
	.option('-f, --force', 'Force init with default package name', false)
	.option('-s, --skip-install', 'Do not install dependencies', false)
	.action(async (args) => {
		const init = await import('./init/index.js').then((m) => m.init);
		init(args);
	});

program
	.command('build')
	.option('-d, --with-database', 'Include database', false)
	.action(async (args) => {
		const build = await import('./build/index.js').then((m) => m.build);
		build(args);
	});

program
	.command('clear')
	.option('-f, --force', 'Force clear without prompt', false)
	.action(async (args) => {
		const clear = await import('./clear/index.js').then((m) => m.clear);
		clear(args);
	});

program
	.command('generate')
	.option('-f, --force', 'Force generation, ignore cache, overwrite routes', false)
	.action(async (args) => {
		const generate = await import('./generate/index.js').then((m) => m.generate);
		generate({
			force: args.force
		});
	});

program.parse(process.argv);
