import { logger } from '$lib/core/logger/index.server.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
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

const packageManagerConfigs: PMConfig = {
  yarn: {
    command: 'yarn add -D drizzle-kit'
  },
  pnpm: {
    command: 'pnpm add -D drizzle-kit && pnpm add drizzle-orm @lucide/svelte sharp',
    preInstall: updatePackageJsonForPnpm,
    postInstall: () => {
      execSync('pnpm rebuild');
    }
  },
  bun: {
    command: 'bun add -D drizzle-kit'
  },
  npm: {
    command: 'npm install -D drizzle-kit'
  },
  deno: {
    command: 'deno install -D npm:drizzle-kit && deno install --allow-scripts=npm:sharp'
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

export function installDependencies(): void {
  const pm = getPackageManager();
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

function updatePackageJsonForPnpm(): void {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');

  if (!existsSync(packageJsonPath)) {
    logger.warn('package.json not found, skipping pnpm configuration');
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Initialize pnpm configuration if it doesn't exist
    if (!packageJson.pnpm) {
      packageJson.pnpm = {};
    }

    // Update onlyBuiltDependencies
    const existingBuiltDeps = packageJson.pnpm.onlyBuiltDependencies || [];
    const newBuiltDeps = ['esbuild', 'sharp'];

    // Merge and deduplicate
    const mergedBuiltDeps = [...new Set([...existingBuiltDeps, ...newBuiltDeps])];
    packageJson.pnpm.onlyBuiltDependencies = mergedBuiltDeps;

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, '\t'), 'utf-8');
    logger.info('[✓] Updated package.json with pnpm configuration');
  } catch (error) {
    logger.error('Failed to update package.json for pnpm:', error);
  }
}
