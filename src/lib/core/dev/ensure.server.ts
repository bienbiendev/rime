import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  CONFIG_DIR,
  GENERATED_DIR,
  generatedConfigServerPath,
  schemaPath
} from './constants.server.js';

const projectRoot = process.cwd();

/**
 * Returns the generated server config's path. Throws when sanitize has not written it.
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

  // A config at LEGACY_DEFAULT but not at CONFIG_DIR means .env does not set RIME_CONFIG_DIR:
  // say so instead of the generic message.
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
function ensureSchema() {
  if (!existsSync(schemaPath(projectRoot))) {
    throw new Error('Unable to find schema, did you run rime init');
  }
}

/**
 * Ensure .env exists
 */
function ensureEnv() {
  const envFile = path.resolve(projectRoot, './.env');
  if (!existsSync(envFile)) throw new Error('Missing .env file');
}

/**
 * Ensure drizzle config exists
 */
function ensureDirzzle() {
  const drizzleConfigFile = path.resolve(projectRoot, './drizzle.config.ts');
  if (!existsSync(drizzleConfigFile)) throw new Error('Missing drizzle.config.ts file');
}

/**
 * Ensure hooks.server exists
 */
function ensureHooks() {
  const hooksServerFile = path.resolve(projectRoot, './src/hooks.server.ts');
  if (!existsSync(hooksServerFile)) throw new Error('Missing src/hooks.server.ts file');
}

/**
 * Ensure db directory exists
 */
function ensureDatabase() {
  const dbDirectory = path.resolve(projectRoot, './db');
  if (!existsSync(dbDirectory)) throw new Error('Missing db directory');
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
