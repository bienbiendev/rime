import { randomId } from '$lib/util/random.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, GENERATED_DIR, configImportPaths } from '../../constants.js';

const PACKAGE = 'rimecms';

export const env = () => `BETTER_AUTH_SECRET=${randomId(32)}
PUBLIC_RIME_URL=http://localhost:5173
RIME_CONFIG_DIR=${CONFIG_DIR}

# RIME_CACHE_ENABLED=false
# RIME_SMTP_USER=user@mail.com
# RIME_SMTP_PASSWORD=supersecret
# RIME_SMTP_HOST=smtphost.com
# RIME_SMTP_PORT=465

RIME_CACHE_ENABLED=false
RIME_LOG_LEVEL=TRACE
RIME_LOG_TO_FILE=true
RIME_LOG_TO_FILE_MAX_DAYS=1
`;

export const defaultConfig = (name: string) => `
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
  $adapter: adapterSqlite('${name}.sqlite'),
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

// Regenerated fresh by rime init every time (setHooks() only skips if the file already
// exists, and `rime clear`/useConfig.js delete it first) — safe to make mode-aware.
const HOOKS_DIR = path.resolve(process.cwd(), 'src');

export const hooks = () => `import { sequence } from '@sveltejs/kit/hooks';
import { handlers } from '${PACKAGE}/server';
import config from '${configImportPaths(HOOKS_DIR).server}';

export const handle = sequence(...(await handlers(config)));
`;

const HOOKS_CONFIG_IMPORT_LINE_REGEX = /^import config from ['"][^'"]*['"];\s*$/m;

/** Writes src/hooks.server.ts if missing. If it already exists, patches only the config
 * import line if it's stale (e.g. after RIME_CONFIG_DIR changes the import path) — the rest
 * of the file may carry real customizations (e.g. an appended handler), so this never
 * touches anything else. Called both at `rime init` and whenever the dev server detects a
 * config change, so the import path never goes stale between the two. Returns whether it
 * wrote anything. */
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
  if (HOOKS_CONFIG_IMPORT_LINE_REGEX.test(content) && !content.includes(expectedImportLine)) {
    writeFileSync(hooksPath, content.replace(HOOKS_CONFIG_IMPORT_LINE_REGEX, expectedImportLine));
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
 * (setDrizzle() in init/index.server.ts). Returns whether it patched anything. */
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
