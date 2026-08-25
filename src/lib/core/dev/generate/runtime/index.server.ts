import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInstalledDependency, OUTPUT_DIR } from '../../constants.js';

const nodeRequire = createRequire(import.meta.url);

export type RuntimeRegistryEntry = { client: string; server: string };
export type RuntimeRegistry = Map<string, RuntimeRegistryEntry>;

/**
 * Walks up from `startDir` to the nearest ancestor containing a `package.json` — self-
 * correcting regardless of how deeply nested this file is (unlike counting a fixed number of
 * `..` segments, which would silently point at the wrong directory, not error, the moment
 * this file's own location changes).
 */
export function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`$rime: could not locate a package root above ${startDir}`);
    }
    dir = parent;
  }
  return dir;
}

/** `findPackageRoot(startDir)/dist` — rime's own package root, specifically. */
export function findDistRoot(startDir: string): string {
  return path.join(findPackageRoot(startDir), 'dist');
}

/** `module.ts` when scanning TS source, `module.js` when scanning a built `dist/`. */
function findModuleFile(dir: string, baseName: string): string | null {
  for (const ext of ['.ts', '.js']) {
    const candidate = path.join(dir, `${baseName}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Direct, single-lookup check for one `<root>/<name>/module(.server)?.ts|js` pair — no
 * directory walk, just the two `fs.existsSync`-style checks `findModuleFile` already does.
 * Used by the Vite plugin's `resolveId`/`load` for on-demand resolution; `scanModulePairs`
 * below (a real walk) stays reserved for type generation, which has no "on demand" available.
 */
export function findModulePair(root: string, name: string): RuntimeRegistryEntry | null {
  const dir = path.join(root, name);
  const client = findModuleFile(dir, 'module');
  const server = findModuleFile(dir, 'module.server');
  return client || server ? { client: client ?? '', server: server ?? '' } : null;
}

/**
 * Recursively finds every `module`/`module.server` folder under `root`, registered under the
 * containing folder's path relative to `root` — `$rime/<key>` mirrors the real path, e.g.
 * `fields/relation/module.ts` under a `lib`-rooted scan registers as `fields/relation`.
 *
 * Either file alone is enough to register (single-sided is legitimate — a server-only piece,
 * e.g. a collection's hooks, never needs a hand-written client stub; the missing side is just
 * an empty string here, same convention `findModulePair` above uses). `rime.generated/` is
 * skipped since it's sanitize's own output, unrelated to this.
 */
function scanModulePairs(root: string): RuntimeRegistry {
  const registry: RuntimeRegistry = new Map();
  if (!fs.existsSync(root)) return registry;

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === OUTPUT_DIR) continue;
      const fullPath = path.join(dir, entry.name);
      const client = findModuleFile(fullPath, 'module');
      const server = findModuleFile(fullPath, 'module.server');
      if (client || server) {
        const key = path.relative(root, fullPath).split(path.sep).join('/');
        registry.set(key, { client: client ?? '', server: server ?? '' });
      }
      walk(fullPath);
    }
  };
  walk(root);

  return registry;
}

/**
 * Builds the `$rime/<name>` → { browser file, server file } lookup table.
 *
 * @example rime's own field, installed as a dependency in some app
 * // /my-app/node_modules/rimecms/dist/fields/relation/module.ts + module.server.ts
 * // → registry.get('fields/relation') → { client: '.../module.ts', server: '.../module.server.ts' }
 * // → import { x } from '$rime/fields/relation'   // resolves
 *
 * @example that same app's own custom field
 * // /my-app/src/lib/fields/geocode/module.ts + module.server.ts
 * // → registry.get('fields/geocode') → { client: '.../module.ts', server: '.../module.server.ts' }
 * // → import { x } from '$rime/fields/geocode'    // resolves, same mechanism, zero extra setup
 *
 * @example nothing on disk for that name
 * // no folder anywhere has both typo/module.ts and typo/module.server.ts
 * // → registry.get('typo') → undefined
 * // → import { x } from '$rime/typo'               // fails: "cannot resolve module"
 */
function packageDependencies(pkgJsonPath: string): string[] {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    return Object.keys(pkg.dependencies ?? {});
  } catch {
    return [];
  }
}

/**
 * Discovers every installed package that depends on `rimecms` — a third-party plugin/field
 * package — starting from the app's own direct dependencies and following the "depends on
 * rimecms" chain transitively (covers e.g. a plugin that itself depends on a field package,
 * not just packages the app installs directly; a dep not on that chain is never followed, so
 * this stays a bounded walk, not a full node_modules scan). Each discovered package's own
 * `dist/` becomes an extra `$rime/<name>` fallback root for the optimizer-flattened-importer
 * case (see nativeLibDir/consumerLibDir in vite/index.server.ts) — computed once at Vite
 * plugin init, never from a runtime importer, so flattening can't affect it either.
 *
 * `dependencies` only, not `peerDependencies` — the convention a rime plugin/field package is
 * expected to declare `rimecms` under. `require.resolve` (not a hand-rolled node_modules join)
 * so this follows whatever layout the package manager actually used (pnpm's nested
 * node_modules included), same as Node's own resolution would.
 *
 * Two discovered packages defining the same bare `$rime/<name>` split name would collide here
 * (first match wins) — narrow, accepted risk: this path only runs after the importer-derived
 * lookup has already failed.
 */
export function findRimePluginRoots(appRoot: string): string[] {
  const roots: string[] = [];
  const visited = new Set<string>();

  function scan(depNames: string[], fromDir: string) {
    for (const name of depNames) {
      if (visited.has(name)) continue;
      visited.add(name);

      let pkgJsonPath: string;
      try {
        pkgJsonPath = nodeRequire.resolve(`${name}/package.json`, { paths: [fromDir] });
      } catch {
        continue;
      }

      const deps = packageDependencies(pkgJsonPath);
      if (deps.includes('rimecms')) {
        const pkgDir = path.dirname(pkgJsonPath);
        roots.push(path.join(pkgDir, 'dist'));
        scan(deps, pkgDir);
      }
    }
  }

  scan(packageDependencies(path.join(appRoot, 'package.json')), appRoot);
  return roots;
}

export function buildRuntimeRegistry(): RuntimeRegistry {
  const registry: RuntimeRegistry = new Map();

  if (isInstalledDependency(import.meta.url)) {
    const nativeLibDir = findDistRoot(path.dirname(fileURLToPath(import.meta.url)));
    for (const [key, entry] of scanModulePairs(nativeLibDir)) {
      registry.set(key, entry);
    }
  }

  const consumerLibDir = path.resolve(process.cwd(), 'src/lib');
  for (const [key, entry] of scanModulePairs(consumerLibDir)) {
    registry.set(key, entry);
  }

  return registry;
}
