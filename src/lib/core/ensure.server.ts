import type { BuiltCollection } from '$lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, GENERATED_DIR, generatedConfigServerPath, schemaPath } from './dev/constants.js';

const projectRoot = process.cwd();

/**
 * Ensure sanitize config exists — the generated server config inside the generated config dir.
 */
export function ensureGeneratedConfig() {
  const configGeneratedPath = path.resolve(projectRoot, GENERATED_DIR, 'rime.config.server.ts');
  if (!existsSync(configGeneratedPath)) {
    throw new Error('Unable to find generated config');
  }
  return generatedConfigServerPath();
}

/**
 * Ensure user config exists — the CONFIG_DIR folder convention.
 */
export function ensureUserConfigExist() {
  const folderConfig = path.resolve(projectRoot, CONFIG_DIR, 'rime.config.server.ts');
  if (existsSync(folderConfig)) return;

  // Every project set up before RIME_CONFIG_DIR existed has its config here — if it's there
  // but not at CONFIG_DIR, this is almost certainly an upgrade whose .env predates the env
  // var, not a missing init, so say that instead of the generic message.
  const LEGACY_DEFAULT = 'src/lib/+rime';
  if (
    CONFIG_DIR !== LEGACY_DEFAULT &&
    existsSync(path.resolve(projectRoot, LEGACY_DEFAULT, 'rime.config.server.ts'))
  ) {
    throw new Error(
      `Unable to find config at ${CONFIG_DIR} — found one at ${LEGACY_DEFAULT} instead. ` +
        `Set RIME_CONFIG_DIR=${LEGACY_DEFAULT} in your .env to keep using it there, or move it to ${CONFIG_DIR} to match the current default.`
    );
  }

  throw new Error('Unable to find config, did you run rime init');
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
