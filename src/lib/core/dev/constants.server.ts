import { isValidSlug } from '#lib/util/string.js';
import path from 'node:path';
import { env } from './env.server.js';

const root = process.cwd();
const SRC_ROOT = path.resolve(root, 'src');

export const CONFIG_DIR = env.RIME_CONFIG_DIR || 'src/+rime';
export const GENERATED_DIR = `${CONFIG_DIR}.generated`;
const INPUT_DIR = path.basename(CONFIG_DIR);
export const OUTPUT_DIR = `${INPUT_DIR}.generated`;

// Folders under src/ the config may not live in: SvelteKit's lib, routes and params, and static.
const RESERVED_DIRS = new Set(
  ['lib', 'routes', 'static', 'params'].map((d) => path.resolve(SRC_ROOT, d))
);
/** Prevent user CONFIG_DIR to be set :
 * - on a SvelteKit folder by mistake
 * - outside of src */
for (const dir of [CONFIG_DIR, GENERATED_DIR]) {
  const resolved = path.resolve(root, dir);
  if (resolved === SRC_ROOT || !resolved.startsWith(SRC_ROOT + path.sep)) {
    throw new Error(`RIME_CONFIG_DIR must resolve to a subdirectory of ${SRC_ROOT} (got "${dir}")`);
  }
  if (RESERVED_DIRS.has(resolved)) {
    throw new Error(
      `RIME_CONFIG_DIR must not be src/lib, src/routes, src/static, or src/params (got "${dir}")`
    );
  }
}

/** The panel's URL segment (e.g. "panel" -> /panel/...). A private variable: SvelteKit ships
 * every public one into the JS bundle of every page, which would show the panel's location to the
 * scanners this setting hides it from. */
export const PANEL_ROUTE = env.RIME_PANEL_ROUTE || 'panel';

if (!isValidSlug(PANEL_ROUTE)) {
  throw new Error(
    `RIME_PANEL_ROUTE must be a single URL segment (letters, numbers, "_"/"-", starting with a letter) — got "${PANEL_ROUTE}"`
  );
}

/** Turns an absolute path into an import specifier relative to `fromDir`, always prefixed
 * with `./` or `../` so it never gets mistaken for a bare package specifier. */
export function relativeImportSpecifier(fromDir: string, toAbsolutePath: string): string {
  const rel = path.relative(fromDir, toAbsolutePath).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** A `#lib/...` specifier for a file under src/lib, null for any other file. Ambient
 * declarations (`declare module '...' { export * from '...' }`) need it: they cannot re-export
 * through a relative path.
 *
 * ```ts
 * libImportSpecifier('/app/src/lib/core/auth/module.server.ts') // '#lib/core/auth/module.server.js'
 * ```
 */
export function libImportSpecifier(absolutePath: string): string | null {
  const rel = path.relative(path.resolve(root, 'src/lib'), absolutePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return `#lib/${rel.split(path.sep).join('/')}`.replace(/\.ts$/, '.js');
}

/** Root-relative filesystem path (posix-style) to a file inside the generated config dir —
 * for Vite's ssrLoadModule, which wants a real file path, not an import specifier. */
function generatedFilePath(file: string): string {
  return path
    .relative(root, path.resolve(root, GENERATED_DIR, file))
    .split(path.sep)
    .join('/');
}

export function generatedConfigServerPath(): string {
  return generatedFilePath('rime.config.server.ts');
}

/** Where the panel/live route templates (common.server.ts) and the generated hooks.server.ts
 * should import the client/server config from — a relative import specifier computed from
 * `fromDir` (the absolute directory of the file doing the importing), so it resolves whether
 * GENERATED_DIR lives under src/lib or elsewhere. One source of truth instead of hardcoding the
 * path (or relying on the #lib alias, which only ever points at src/lib) at each call site. */
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

/** The param matchers rime generates, which the app's own params file spreads:
 *
 * ```ts
 * // src/params.ts
 * import { params as rime } from './+rime.generated/params.ts';
 * export const params = defineParams({ ...rime });
 * ```
 */
export function paramsPath(projectRoot: string = process.cwd()): string {
  return path.resolve(projectRoot, GENERATED_DIR, 'params.ts');
}
