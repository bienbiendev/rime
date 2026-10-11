import { loadEnv } from 'vite';

/**
 * The app's environment, for the code that runs outside of SvelteKit: the CLI and the Vite
 * plugin. Read the way SvelteKit reads it, the shell first:
 *
 * ```
 * shell > .env.development.local > .env.development > .env.local > .env
 * ```
 *
 * The app itself reads `$app/env/private` and `$app/env/public`.
 */
export const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

/** The logger's settings, read like src/env.ts reads them for the app. */
export const logSettings = {
  level: env.RIME_LOG_LEVEL || 'INFO',
  toFile: env.RIME_LOG_TO_FILE === 'true',
  maxDays: Number(env.RIME_LOG_TO_FILE_MAX_DAYS || 30)
};
