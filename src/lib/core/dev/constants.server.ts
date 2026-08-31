import dotenv from 'dotenv';
import path from 'node:path';
import { isValidSlug } from '../../util/string.js';

// Must run before RIME_CONFIG_DIR is read below. ES import hoisting evaluates this module's
// top-level code before any *importing* file's own top-level statements — including a
// dotenv.config() call there — so loading .env here, first, is the only way every entry point
// (CLI, dev-server, drizzle.config.ts, etc.) reliably sees it. override:true so .env is the
// explicit source of truth, not whatever a shell plugin (autoenv, direnv, ...) already exported
// from some other project's .env. The only dotenv.config() call in the codebase — a second one
// elsewhere would race this one.
dotenv.config({ override: true });

const root = process.cwd();
const SRC_ROOT = path.resolve(root, 'src');

export const CONFIG_DIR = process.env.RIME_CONFIG_DIR || 'src/+rime';
export const GENERATED_DIR = `${CONFIG_DIR}.generated`;
export const INPUT_DIR = path.basename(CONFIG_DIR);
export const OUTPUT_DIR = `${INPUT_DIR}.generated`;

/** The panel's URL segment (e.g. "panel" -> /panel/...). Kept as a bare segment, never a
 * PUBLIC_-prefixed env var: SvelteKit ships every PUBLIC_ value into the JS bundle of every
 * page (including the public site), which would defeat the point of letting an operator hide
 * this path from automated CMS-admin scanners. */
export const PANEL_ROUTE = (process.env.RIME_PANEL_ROUTE || 'panel').replace(/^\/+|\/+$/g, '');

if (!isValidSlug(PANEL_ROUTE)) {
  throw new Error(
    `RIME_PANEL_ROUTE must be a single URL segment (letters, numbers, "_"/"-", starting with a letter) — got "${PANEL_ROUTE}"`
  );
}

const RESERVED_DIRS = new Set(['lib', 'routes', 'static', 'params'].map((d) => path.resolve(SRC_ROOT, d)));

for (const dir of [CONFIG_DIR, GENERATED_DIR]) {
  const resolved = path.resolve(root, dir);
  if (resolved === SRC_ROOT || !resolved.startsWith(SRC_ROOT + path.sep)) {
    throw new Error(`RIME_CONFIG_DIR must resolve to a subdirectory of ${SRC_ROOT} (got "${dir}")`);
  }
  if (RESERVED_DIRS.has(resolved)) {
    throw new Error(`RIME_CONFIG_DIR must not be src/lib, src/routes, src/static, or src/params (got "${dir}")`);
  }
}

/** Turns an absolute path into an import specifier relative to `fromDir`, always prefixed
 * with `./` or `../` so it never gets mistaken for a bare package specifier. */
export function relativeImportSpecifier(fromDir: string, toAbsolutePath: string): string {
  const rel = path.relative(fromDir, toAbsolutePath).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** Root-relative filesystem path (posix-style) to a file inside the generated config dir —
 * for Vite's ssrLoadModule, which wants a real file path, not an import specifier. */
function generatedFilePath(file: string): string {
  return path.relative(root, path.resolve(root, GENERATED_DIR, file)).split(path.sep).join('/');
}

export function generatedConfigServerPath(): string {
  return generatedFilePath('rime.config.server.ts');
}

/** Where the panel/live route templates (common.server.ts) and the generated hooks.server.ts
 * should import the client/server config from — a relative import specifier computed from
 * `fromDir` (the absolute directory of the file doing the importing), so it resolves whether
 * GENERATED_DIR lives under src/lib or elsewhere. One source of truth instead of hardcoding the
 * path (or relying on the $lib alias, which only ever points at src/lib) at each call site. */
export function configImportPaths(fromDir: string) {
  return {
    client: relativeImportSpecifier(fromDir, path.resolve(root, GENERATED_DIR, 'rime.config.js')),
    server: relativeImportSpecifier(
      fromDir,
      path.resolve(root, GENERATED_DIR, 'rime.config.server.js')
    )
  };
}

/** Same idea as configImportPaths — one source of truth for where the generated schema
 * lives instead of hardcoding the path at each call site. */
export function schemaPath(projectRoot: string = process.cwd()): string {
  return path.resolve(projectRoot, GENERATED_DIR, 'schema.server.ts');
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
