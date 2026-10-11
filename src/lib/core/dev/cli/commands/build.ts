import { logger } from '#lib/core/logger.server.js';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { trycatch } from '#lib/util/function.js';
import { importAdapterHooks, recordedHooksModule } from '../util/adapter-hooks.server.js';
import { getInvokingPackageManager } from '../util/package-manager.server.js';
import { usesBunScripts } from '../util/package.server.js';
import { envProduction, nodeServer } from '../templates/build.js';

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
  bun: {
    addDeps: 'bun add sharp serve-static',
    prodInstall: 'bun install --production',
    runEnv: 'bunx rime env'
  }
} as const;

export const build = async (args: {
  withEnv?: boolean;
  withStatic?: boolean;
  withStorage?: boolean;
}) => {
  const bun = usesBunScripts();

  // -w ships the database: refused while the adapter asks for a step first, `rime db:move` for a
  // project whose database is not in storage/ yet, as a dev boot is
  if (args.withStorage) {
    const [error] = await trycatch(async () =>
      (await importAdapterHooks(recordedHooksModule())).boot()
    );
    if (error) {
      logger.error(`[✗] ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }

  // Delete app folder if it exists
  if (existsSync('./app')) {
    rmSync('./app', { recursive: true, force: true });
  }

  // Build
  // A Bun app builds on Bun: `bun --bun` runs vite, and anything the build imports, on Bun
  // rather than on its bin's Node shebang
  const result = bun
    ? spawnSync('bun', ['--bun', './node_modules/.bin/vite', 'build'], { stdio: 'inherit' })
    : spawnSync('./node_modules/.bin/vite', ['build'], { stdio: 'inherit' });
  console.log('');

  if (result.error || result.status !== 0) {
    logger.error('[✗] vite build failed, nothing packaged');
    process.exitCode = 1;
    return;
  }

  // Create app directory
  mkdirSync('./app', { recursive: true });

  // Move build folder
  renameSync('./build', './app/build');
  logger.debug('[✓] /app folder created');

  // Copy package.json
  copyFileSync('./package.json', './app/package.json');
  logger.debug('[✓] package.json copied');

  // storage/: the database and the uploads
  if (args.withStorage) {
    if (existsSync('./storage')) {
      cpSync('./storage', './app/storage', { recursive: true });
      logger.debug('[✓] storage directory copied');
    } else {
      logger.warn('No storage directory to copy (skip)');
    }
  }

  if (args.withStatic) {
    cpSync('./static', './app/static', { recursive: true });
    logger.debug('[✓] static directory copied');
  }

  // Create main entry server file
  writeFileSync('./app/index.js', nodeServer);
  logger.debug('[✓] server created at app/index.js');

  // Create .env file if flag is set
  const envContent = envProduction();
  if (args.withEnv) {
    writeFileSync('./app/.env', envContent);
    logger.debug('[✓] .env file created at app/.env');
  }

  console.log('----------------------------------------------------------------\n');
  console.log('## Next steps :');
  console.log('');
  console.log('    cd ./app');
  const pm = bun ? 'bun' : getInvokingPackageManager() === 'pnpm' ? 'pnpm' : 'npm';
  console.log('    ' + installCommands[pm].addDeps);
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
