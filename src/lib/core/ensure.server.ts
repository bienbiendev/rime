import type { BuiltCollection } from '$lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { INPUT_DIR, OUTPUT_DIR, schemaPath } from './dev/constants.js';

const projectRoot = process.cwd();

/**
 * Ensure sanitize config exists — the generated server config inside rime.generated/.
 */
export function ensureGeneratedConfig() {
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
 * Ensure user config exists — the src/lib/+rime/ folder convention.
 */
export function ensureUserConfigExist() {
  const folderConfig = path.resolve(projectRoot, 'src/lib', INPUT_DIR, 'rime.config.server.ts');

  if (!existsSync(folderConfig)) {
    throw new Error('Unable to find config, did you run rime init');
  }
}

/**
 * Ensure schema exists (see adapter-sqlite/generate-schema/write.server.ts, which writes to
 * the same path).
 */
export function ensureSchema() {
  if (!existsSync(schemaPath(projectRoot))) {
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
