import { logger } from '#lib/core/logger.server.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

type PackageManagerName = 'yarn' | 'pnpm' | 'bun' | 'npm' | 'deno';

const packageManagersMap = {
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
  bun: 'bun.lock',
  npm: 'package-lock.json',
  deno: 'deno.lock'
} as const;

type PMConfig = Record<
  Exclude<PackageManagerName, 'yarn' | 'deno'>,
  {
    command: (devDeps: string[]) => string;
    preInstall?: () => void;
    postInstall?: () => void;
  }
>;

// Drizzle is pinned to the exact release rime is built against: `@rc` is a moving tag, and a
// prerelease range drifts across API changes.
const DRIZZLE = '1.0.0-rc.4';

const deps = [`drizzle-orm@${DRIZZLE}`, '@libsql/client', '@lucide/svelte', 'sharp'];
// Both packs build with adapter-node: the Bun pack runs the same server on Bun
export const SVELTEKIT_ADAPTER = '@sveltejs/adapter-node';
const devDeps = [SVELTEKIT_ADAPTER, `drizzle-kit@${DRIZZLE}`];

const packageManagerConfigs: PMConfig = {
  pnpm: {
    command: (devDeps) => `pnpm add -D ${devDeps.join(' ')} && pnpm add ${deps.join(' ')}`,
    preInstall: configurePnpm,
    postInstall: () => {
      execSync('pnpm rebuild');
    }
  },
  bun: {
    command: (devDeps) => `bun add -D ${devDeps.join(' ')} && bun add ${deps.join(' ')}`
  },
  npm: {
    command: (devDeps) => `npm install -D ${devDeps.join(' ')} && npm install ${deps.join(' ')}`
  }
};

export function getPackageManager(): PackageManagerName {
  for (const [packageManager, lockFile] of Object.entries(packageManagersMap)) {
    const pathToLockFile = path.resolve(process.cwd(), lockFile);
    if (existsSync(pathToLockFile)) {
      return packageManager as PackageManagerName;
    }
  }
  return 'npm';
}

/**
 * Detects the package manager used to invoke the currently running command
 * (e.g. `pnpm rime build` vs `npx rime build`), based on the user agent npm/pnpm/yarn/bun
 * set on the child process. Falls back to npm, which is also what npx reports.
 */
export function getInvokingPackageManager(): PackageManagerName {
  const userAgent = process.env.npm_config_user_agent;
  if (!userAgent) return 'npm';

  const name = userAgent.split('/')[0];
  if (name === 'pnpm' || name === 'yarn' || name === 'bun' || name === 'npm' || name === 'deno') {
    return name;
  }
  return 'npm';
}

export function installDependencies() {
  const pm = getInvokingPackageManager();

  if (pm === 'deno' || pm === 'yarn') {
    throw new Error('Unsupported package manager ' + pm);
  }

  const config = packageManagerConfigs[pm];

  // Pre installation hooks
  config.preInstall?.();

  // Main installation
  const command = config.command(devDeps);
  logger.debug('exec : ' + command);
  execSync(command);

  // Post installation hooks
  config.postInstall?.();
}

/**
 * Writes pnpm's project settings into pnpm-workspace.yaml (`pnpm config set --location=project`
 * creates it when missing). `allowBuilds` lets only sharp run its build script. `strict-dep-builds`
 * is off: with it on, any dependency build script missing from `allowBuilds` fails the whole
 * install with ERR_PNPM_IGNORED_BUILDS.
 */
function configurePnpm(): void {
  const allowBuilds = JSON.stringify({ esbuild: false, sharp: true, 'better-sqlite3': false });
  try {
    execSync(`pnpm config set --location=project --json allowBuilds '${allowBuilds}'`);
    execSync('pnpm config set --location=project strict-dep-builds false');
    logger.debug(
      '[✓] Configured pnpm-workspace.yaml: allowBuilds (sharp) and strict-dep-builds (false)'
    );
  } catch (error) {
    logger.error('Failed to configure pnpm:', error);
  }
}
