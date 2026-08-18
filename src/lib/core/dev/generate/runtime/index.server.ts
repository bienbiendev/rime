import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInstalledDependency, OUTPUT_DIR } from '../../constants.js';

export type RuntimeRegistryEntry = { client: string; server: string };
export type RuntimeRegistry = Map<string, RuntimeRegistryEntry>;

/**
 * Walks up from `startDir` to the nearest ancestor containing a `package.json`, then returns
 * its `dist/` — self-correcting regardless of how deeply nested this file is (unlike counting
 * a fixed number of `..` segments, which would silently point at the wrong directory, not
 * error, the moment this file's own location changes).
 */
function findDistRoot(startDir: string): string {
  let dir = startDir;
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`$rime: could not locate rimecms's package root above ${startDir}`);
    }
    dir = parent;
  }
  return path.join(dir, 'dist');
}

/** `module.ts` when scanning TS source, `module.js` when scanning a built `dist/` — same helper
 *  `convertToServerModulePath` (fields/index.server.ts) uses for the same reason. */
function findModuleFile(dir: string, baseName: string): string | null {
  for (const ext of ['.ts', '.js']) {
    const candidate = path.join(dir, `${baseName}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Recursively finds every `module`/`module.server` pair under `root`, registered under the
 * containing folder's path relative to `root` — `$rime/<key>` mirrors the real path, e.g.
 * `fields/relation/module.ts` under a `lib`-rooted scan registers as `fields/relation`.
 *
 * Both files are required to register a `$rime/<key>` entry — a `module.server` on its own
 * (the common case: a field with only `toType`, no request-time hook needing a client/server
 * split) is valid and expected, just doesn't need a `$rime/<key>` entry at all, since nothing
 * would import it that way; `getFieldPrivateModule` finds `toType` independently of this scan.
 * `+rime.generated/` is skipped since it's sanitize's own output, unrelated to this.
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
      if (client && server) {
        const key = path.relative(root, fullPath).split(path.sep).join('/');
        registry.set(key, { client, server });
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
