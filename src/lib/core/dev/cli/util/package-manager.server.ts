import { logger } from '$lib/core/logger.server.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

export type PackageManagerName = 'yarn' | 'pnpm' | 'bun' | 'npm' | 'deno';

const packageManagersMap = {
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
  bun: 'bun.lock',
  npm: 'package-lock.json',
  deno: 'deno.lock'
} as const;

type PMConfig = Record<
  PackageManagerName,
  {
    command: string;
    preInstall?: () => void;
    postInstall?: () => void;
  }
>;

const deps = ['drizzle-orm', '@libsql/client', '@lucide/svelte', 'sharp'];
const devDeps = ['@sveltejs/adapter-node', 'drizzle-kit'];

const packageManagerConfigs: PMConfig = {
  yarn: {
    command: 'echo "yarn is not supported, please use pnpm or npm" && exit 1'
  },
  pnpm: {
    command: `pnpm add -D ${devDeps.join(' ')} && pnpm add ${deps.join(' ')}`,
    preInstall: configurePnpm,
    postInstall: () => {
      execSync('pnpm rebuild');
    }
  },
  bun: {
    command: `bun add -D ${devDeps.join(' ')} && bun add ${deps.join(' ')}`
  },
  npm: {
    command: `npm install -D ${devDeps.join(' ')} && npm install ${deps.join(' ')}`
  },
  deno: {
    command: 'echo "deno is not supported, please use pnpm or npm" && exit 1'
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
  logger.info('exec : ' + config.command);
  execSync(config.command);

  // Post installation hooks
  config.postInstall?.();
}

/**
 * pnpm 11 no longer reads the "pnpm" field in package.json (onlyBuiltDependencies
 * included) - every pnpm-specific setting moved to pnpm-workspace.yaml, and
 * onlyBuiltDependencies itself was replaced by allowBuilds (a name -> boolean map).
 * `pnpm config set --location=project` writes there directly (creating the file if
 * it doesn't exist yet, even for a non-monorepo single package).
 *
 * strictDepBuilds is also now on by default: any dependency (however deep) with a
 * build script that isn't in allowBuilds hard-fails the whole install with
 * ERR_PNPM_IGNORED_BUILDS instead of just skipping that one script. allowBuilds only
 * covers esbuild/sharp; the rest of this command's tree (drizzle-kit, adapter-node,
 * ...) will always have *something* pnpm hasn't seen before, and pinning every one of
 * them here would just break again on their next update - so strict-dep-builds is
 * turned off the same way.
 */
function configurePnpm(): void {
  const allowBuilds = JSON.stringify({ esbuild: false, sharp: true, 'better-sqlite3': false });
  try {
    execSync(`pnpm config set --location=project --json allowBuilds '${allowBuilds}'`);
    execSync('pnpm config set --location=project strict-dep-builds false');
    logger.info(
      '[✓] Configured pnpm-workspace.yaml: allowBuilds (sharp) and strict-dep-builds (false)'
    );
  } catch (error) {
    logger.error('Failed to configure pnpm:', error);
  }
}
