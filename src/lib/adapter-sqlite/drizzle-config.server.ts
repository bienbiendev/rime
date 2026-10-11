import { GENERATED_DIR } from '#lib/core/dev/constants.server.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DRIZZLE_CONFIG, SQLITE_DIRECTORY } from './constant.js';

/** The `drizzle.config.ts` `rime init` writes for a database named `name`. */
export const drizzleConfig = (name: string) => `
import { defineConfig, type Config } from 'drizzle-kit';

export const config: Config = {
  schema: './${GENERATED_DIR}/schema.server.ts',
  out: './${SQLITE_DIRECTORY}',
  strict: false,
  dialect: 'sqlite',
  dbCredentials: {
    url: './${SQLITE_DIRECTORY}/${name}.sqlite'
  }
};

export default defineConfig(config);
`;

const DRIZZLE_SCHEMA_LINE_REGEX = /^\s*schema:\s*['"][^'"]*['"],?\s*$/m;

/** Patches drizzle.config.ts's schema path line if it's stale (e.g. after RIME_CONFIG_DIR
 * changes) — only that one line, since the rest of the file may carry real customizations
 * (verbose, custom fields, etc.). Must run before generateSchema()'s own drizzle-kit
 * generate/migrate shell-out, which reads this file from disk. No-op if the file doesn't
 * exist — creating it from scratch needs a project name, which is `rime init`'s job. Returns
 * whether it patched anything. */
export function regenerateDrizzleConfig(root: string = process.cwd()): boolean {
  const drizzleConfigPath = path.join(root, DRIZZLE_CONFIG);
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
