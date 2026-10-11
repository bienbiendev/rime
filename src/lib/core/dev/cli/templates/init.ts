import { logger } from '#lib/core/logger.server.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  GENERATED_DIR,
  configImportPaths,
  paramsPath,
  relativeImportSpecifier
} from '../../constants.server.js';
import { SVELTEKIT_ADAPTER } from '../util/package-manager.server.js';

const PACKAGE = 'rimecms';

export const defaultConfig = (name: string, driver: 'libsql' | 'bun' = 'libsql') => `
import { Collection, rime } from '$rime/config';
import { text } from '${PACKAGE}/fields';
import { adapterSqlite } from '${PACKAGE}/adapter-sqlite';

const Pages = Collection.create('pages', {
	fields: [text('title').isTitle()]
});

const Medias = Collection.create('medias', {
  upload: true,
	fields: [
    text('alt').required(),
  ]
});

export default rime({
  $adapter: adapterSqlite('${name}.sqlite'${driver === 'bun' ? ", { driver: 'bun' }" : ''}),
  collections: [Pages, Medias]
});
`;

export const drizzleConfig = (name: string) => `
import { defineConfig, type Config } from 'drizzle-kit';

export const config: Config = {
  schema: './${GENERATED_DIR}/schema.server.ts',
  out: './db',
  strict: false,
  dialect: 'sqlite',
  dbCredentials: {
    url: './db/${name}.sqlite'
  }
};

export default defineConfig(config);
`;

// src/, where hooks.server.ts lives: its config import is relative to it.
const HOOKS_DIR = path.resolve(process.cwd(), 'src');

const HANDLE_ERROR_EXPORT = `export { handleError } from '${PACKAGE}/server';`;

export const hooks = () => `import { sequence } from '@sveltejs/kit/hooks';
import { handlers } from '${PACKAGE}/server';
import config from '${configImportPaths(HOOKS_DIR).server}';

export const handle = sequence(...(await handlers(config)));
${HANDLE_ERROR_EXPORT}
`;

const HOOKS_CONFIG_IMPORT_LINE_REGEX = /^import config from ['"][^'"]*['"];\s*$/m;

/** Writes src/hooks.server.ts if missing. If it already exists, patches only the config
 * import line if it's stale (e.g. after RIME_CONFIG_DIR changes the import path), and adds
 * rime's `handleError` when the file has none — the rest of the file may carry real
 * customizations (e.g. an appended handler), so this never touches anything else. Called both
 * at `rime init` and whenever the dev server detects a config change, so the import path never
 * goes stale between the two. Returns whether it wrote anything. */
export function regenerateHooks(root: string = process.cwd()): boolean {
  const hooksPath = path.join(root, 'src', 'hooks.server.ts');
  const srcDir = path.join(root, 'src');

  if (!existsSync(hooksPath)) {
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true });
    }
    writeFileSync(hooksPath, hooks(), 'utf-8');
    return true;
  }

  const expectedImportLine = `import config from '${configImportPaths(HOOKS_DIR).server}';`;
  const content = readFileSync(hooksPath, 'utf-8');
  let next = content;
  if (HOOKS_CONFIG_IMPORT_LINE_REGEX.test(next) && !next.includes(expectedImportLine)) {
    next = next.replace(HOOKS_CONFIG_IMPORT_LINE_REGEX, expectedImportLine);
  }
  // An app with its own handleError keeps it: it is theirs to call rime's from it
  if (!/\bhandleError\b/.test(next)) {
    next = `${next.trimEnd()}\n${HANDLE_ERROR_EXPORT}\n`;
  }
  if (next === content) return false;
  writeFileSync(hooksPath, next);
  return true;
}

/** The variables rime reads from `$app/env/public` and `$app/env/private`, as src/env.ts declares
 * them. One without a `schema` is required: the app refuses to start without it. */
const ENV_VARS: Record<string, string> = {
  SITE_URL: '{ public: true }',
  BETTER_AUTH_SECRET: '{}',
  RIME_PANEL_ROUTE: "{ schema: (value) => value ?? 'panel' }",
  RIME_LOG_LEVEL: "{ schema: (value) => value ?? 'INFO' }",
  RIME_LOG_TO_FILE: "{ schema: (value) => value === 'true' }",
  RIME_LOG_TO_FILE_MAX_DAYS: '{ schema: (value) => Number(value ?? 30) }',
  RIME_CACHE_ENABLED: "{ schema: (value) => value === 'true' }",
  RIME_CACHE_STRATEGY: "{ schema: (value) => value ?? 'memory' }",
  SMTP_HOST: '{ schema: (value) => value }',
  SMTP_PORT: '{ schema: (value) => Number(value ?? 465) }',
  SMTP_USER: '{ schema: (value) => value }',
  SMTP_PASSWORD: '{ schema: (value) => value }'
};

/** `names`' declarations, one per line. */
export const envVarDeclarations = (names: string[]) =>
  names.map((name) => `  ${name}: ${ENV_VARS[name]}`).join(',\n');

/** src/env.ts. The values still come from .env or the process environment. */
export const envVars = () => `import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
${envVarDeclarations(Object.keys(ENV_VARS))}
});
`;

/** The variables rime reads that `content`, an src/env.ts, does not declare. */
export const missingEnvVars = (content: string) =>
  Object.keys(ENV_VARS).filter((name) => !new RegExp(`\\b${name}\\s*:`).test(content));

const DEFINE_ENV_VARS_REGEX = /defineEnvVars\(\s*\{/;

/**
 * `content` with `names` declared at the top of its `defineEnvVars({`, null when it has none.
 *
 * ```ts
 * addEnvVars(`defineEnvVars({\n  API_KEY: {}\n})`, ['SITE_URL'])
 * // `defineEnvVars({\n  SITE_URL: { public: true },\n  API_KEY: {}\n})`
 * ```
 */
export const addEnvVars = (content: string, names: string[]) =>
  DEFINE_ENV_VARS_REGEX.test(content)
    ? content.replace(DEFINE_ENV_VARS_REGEX, (call) => `${call}\n${envVarDeclarations(names)},`)
    : null;

/** The line of the app's params file that imports rime's matchers, from `fromDir`. With its `.ts`:
 * SvelteKit's build loads src/params.ts with Node's own `import()`, which maps no `.js` to `.ts`. */
const paramsImportLine = (fromDir: string) =>
  `import { params as rime } from '${relativeImportSpecifier(fromDir, paramsPath())}';`;

export const appParams = (fromDir: string) => `import { defineParams } from '@sveltejs/kit/params';
${paramsImportLine(fromDir)}

export const params = defineParams({ ...rime });
`;

const PARAMS_IMPORT_LINE_REGEX = /^import \{ params as rime \} from ['"][^'"]*['"];\s*$/m;

/** SvelteKit reads every param matcher from one file, so rime's matchers have to be spread
 * into the app's own. Writes src/params.ts if the app has no params file. If it has one,
 * patches only the import of rime's matchers when it's stale (e.g. after RIME_CONFIG_DIR
 * changes), and warns when the file does not import them at all. Returns whether it wrote
 * anything. */
export function regenerateParams(root: string = process.cwd()): boolean {
  const candidates = ['params.ts', 'params.js', 'params/index.ts', 'params/index.js'].map((file) =>
    path.join(root, 'src', file)
  );
  const paramsFile = candidates.find((file) => existsSync(file));

  if (!paramsFile) {
    writeFileSync(candidates[0], appParams(path.dirname(candidates[0])), 'utf-8');
    return true;
  }

  const expectedImportLine = paramsImportLine(path.dirname(paramsFile));
  const content = readFileSync(paramsFile, 'utf-8');
  if (!PARAMS_IMPORT_LINE_REGEX.test(content)) {
    logger.warn(
      `${path.relative(root, paramsFile)} does not include rime's param matchers, so the panel routes cannot match. Add them:\n\n` +
        `${expectedImportLine}\nexport const params = defineParams({ ...rime, /* yours */ });\n`
    );
    return false;
  }
  if (!content.includes(expectedImportLine)) {
    writeFileSync(paramsFile, content.replace(PARAMS_IMPORT_LINE_REGEX, expectedImportLine));
    return true;
  }
  return false;
}

const DRIZZLE_SCHEMA_LINE_REGEX = /^\s*schema:\s*['"][^'"]*['"],?\s*$/m;

/** Patches drizzle.config.ts's schema path line if it's stale (e.g. after RIME_CONFIG_DIR
 * changes) — only that one line, since the rest of the file may carry real customizations
 * (verbose, custom fields, etc.). Must run before generateSchema()'s own drizzle-kit
 * generate/migrate shell-out, which reads this file from disk. No-op if the file doesn't
 * exist — creating it from scratch needs a project name, which is `rime init`'s job
 * (setDrizzle() in cli/commands/init.server.ts). Returns whether it patched anything. */
export function regenerateDrizzleConfig(root: string = process.cwd()): boolean {
  const drizzleConfigPath = path.join(root, 'drizzle.config.ts');
  if (!existsSync(drizzleConfigPath)) return false;

  const expectedSchemaLine = `  schema: './${GENERATED_DIR}/schema.server.ts',`;
  const content = readFileSync(drizzleConfigPath, 'utf-8');
  if (DRIZZLE_SCHEMA_LINE_REGEX.test(content) && !content.includes(expectedSchemaLine)) {
    writeFileSync(
      drizzleConfigPath,
      content.replace(DRIZZLE_SCHEMA_LINE_REGEX, expectedSchemaLine)
    );
    return true;
  }
  return false;
}

const ADAPTER_CONFIG_FILES = ['vite.config.ts', 'vite.config.js'];

/** Swaps adapter-auto for adapter-node in the app's Vite config. adapter-auto produces nothing
 * for a plain Node or Bun server. Any other adapter is the app's choice and left alone. Returns
 * the files it patched. */
export function setSvelteKitAdapter(root: string): string[] {
  const pattern = /from\s*(['"])@sveltejs\/adapter-auto\1/g;

  const patched: string[] = [];
  for (const file of ADAPTER_CONFIG_FILES) {
    const configPath = path.join(root, file);
    if (!existsSync(configPath)) continue;
    const content = readFileSync(configPath, 'utf-8');
    const next = content.replace(
      pattern,
      (_, quote) => `from ${quote}${SVELTEKIT_ADAPTER}${quote}`
    );
    if (next !== content) {
      writeFileSync(configPath, next);
      patched.push(file);
    }
  }
  return patched;
}
