import type { BuiltCollection } from '$lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { INPUT_DIR, isFolderConfig, OUTPUT_DIR } from './dev/constants.js';

const projectRoot = process.cwd();

/**
 * Ensure sanitize config exists — in standalone mode the "generated" server config is just
 * the user's own real src/lib/rime.config.server.ts, nothing to look for in rime.generated/.
 */
export function ensureGeneratedConfig() {
  if (!isFolderConfig(projectRoot)) {
    const standaloneServerConfig = path.resolve(projectRoot, 'src/lib', 'rime.config.server.ts');
    if (!existsSync(standaloneServerConfig)) {
      throw new Error('Unable to find generated config');
    }
    return path.join('$lib', 'rime.config.server.js');
  }

  const configGeneratedPath = path.resolve(
    projectRoot,
    'src/lib',
    OUTPUT_DIR,
    'rime.config.server.ts'
  );
  if (!existsSync(configGeneratedPath)) {
    throw new Error('Unable to find generated config');
  }
  return path.join('$lib', OUTPUT_DIR, 'rime.config.server.js');
}

/**
 * Ensure user config exists — either the src/lib/rime/ folder convention, or a standalone
 * src/lib/rime.config.server.ts (see core/dev/generate/sanitize/index.server.js).
 */
export function ensureUserConfigExist() {
  const folderConfig = path.resolve(projectRoot, 'src/lib', INPUT_DIR, 'rime.config.ts');
  const standaloneConfig = path.resolve(projectRoot, 'src/lib', 'rime.config.server.ts');

  if (!existsSync(folderConfig) && !existsSync(standaloneConfig)) {
    throw new Error('Unable to find config, did you run rime init');
  }
}

/**
 * Ensure schema exists — always src/lib/rime.schema.server.ts, in either config mode. Not
 * inside OUTPUT_DIR: unlike rime.config.{ts,server.ts}, the schema was never part of the
 * sanitized-source mirror, so tying it to folder-mode's output dir was never load-bearing —
 * just kept it consistent with everything else that lives directly in src/lib/ now.
 */
export function ensureSchema() {
  const schemaPath = path.resolve(projectRoot, 'src/lib', 'rime.schema.server.ts');

  if (!existsSync(schemaPath)) {
    throw new Error('Unable to find schema, did you run rime init');
  }
}

/**
 * Ensure .env exists
 */
export function ensureEnv() {
  const envFile = path.resolve(projectRoot, './.env');
  if (!existsSync(envFile)) throw new Error('Missing .env file');
}

/**
 * Ensure drizzle config exists
 */
export function ensureDirzzle() {
  const drizzleConfigFile = path.resolve(projectRoot, './drizzle.config.ts');
  if (!existsSync(drizzleConfigFile)) throw new Error('Missing drizzle.config.ts file');
}

/**
 * Ensure hooks.server exists
 */
export function ensureHooks() {
  const hooksServerFile = path.resolve(projectRoot, './src/hooks.server.ts');
  if (!existsSync(hooksServerFile)) throw new Error('Missing src/hooks.server.ts file');
}

/**
 * Ensure db directory exists
 */
export function ensureDatabase() {
  const dbDirectory = path.resolve(projectRoot, './db');
  if (!existsSync(dbDirectory)) throw new Error('Missing db directory');
}

export function ensureMedias<C extends { collections?: BuiltCollection[] }>(config: C) {
  const hasUpload = (config.collections || []).some((collection) => !!collection.upload);
  if (hasUpload) {
    const mediasDirectory = path.resolve(process.cwd(), 'static/medias');
    if (!existsSync(mediasDirectory)) {
      mkdirSync(mediasDirectory, { recursive: true });
    }
  }
}

export const ensureHasInit = () => {
  ensureEnv();
  ensureDirzzle();
  ensureHooks();
  ensureDatabase();
  ensureUserConfigExist();
  ensureGeneratedConfig();
  ensureSchema();
};
