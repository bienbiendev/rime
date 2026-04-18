import type { BuiltCollection } from '$lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { INPUT_DIR, OUTPUT_DIR } from './dev/constants.js';

const projectRoot = process.cwd();

/**
 * Ensure sanitize config exists
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
 * Ensure user config exists
 */
export function ensureUserConfigExist() {
  const configPath = path.resolve(projectRoot, 'src/lib', INPUT_DIR, 'rime.config.ts');

  if (!existsSync(configPath)) {
    throw new Error('Unable to find config, did you run rime init');
  }
}

/**
 * Ensure schema exists
 */
export function ensureSchema() {
  const schemaPath = path.resolve(projectRoot, 'src/lib', OUTPUT_DIR, 'schema.server.ts');

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
