import { existsSync } from 'node:fs';
import path from 'node:path';

export const OUTPUT_DIR = '+rime.generated';
export const INPUT_DIR = '+rime';

/** True when src/lib/rime/ exists — the current, unchanged folder-mode convention.
 * False means a standalone src/lib/rime.config.server.ts instead (see sanitize/index.server.js). */
export function isFolderConfig(root: string = process.cwd()): boolean {
  return existsSync(path.resolve(root, 'src/lib', INPUT_DIR));
}

/** Where the panel/live route templates (common.server.ts) should import the client config
 * from, and where the dev-server watcher/hot-reload should read the server config from —
 * one source of truth instead of scattered isFolderConfig checks at each call site. */
export function configImportPaths(root: string = process.cwd()) {
  return isFolderConfig(root)
    ? {
        client: `$lib/${OUTPUT_DIR}/rime.config.js`,
        server: `$lib/${OUTPUT_DIR}/rime.config.server.js`
      }
    : { client: '$lib/rime.config.js', server: '$lib/rime.config.server.js' };
}

/**
 * True when `metaUrl` (pass the caller's own `import.meta.url` — this can't be one shared
 * value, it depends on which file is asking) is running from inside an installed `rimecms`
 * package (node_modules/rimecms/...), false when running from rime's own repo. Deliberately
 * filesystem-based rather than an env var: a shell dotenv plugin auto-loading this repo's own
 * .env (which used to set IS_RIME_REPO=true) into every child process — including an unrelated
 * consumer app's dev server — made that value unreliable; this can't leak the same way.
 */
export function isInstalledDependency(metaUrl: string) {
  return metaUrl.includes('/node_modules/rimecms/');
}
