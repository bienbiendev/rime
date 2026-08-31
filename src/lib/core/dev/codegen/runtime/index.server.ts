import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../../constants.server.js';

export type RuntimeRegistryEntry = { client: string; server: string };
export type RuntimeRegistry = Map<string, RuntimeRegistryEntry>;

/**
 * Finds an installed package's root by walking up from `fromDir`, checking each ancestor's
 * `node_modules/<pkgName>` directly for a `package.json` — the pre-`exports` Node resolution
 * algorithm, pure directory existence, no `exports`-conditions matching involved at all.
 *
 * Needed in place of `require.resolve`/`import.meta.resolve`: both gate on a package's own
 * `exports` map matching some condition set (`"require"`/`"default"` for the former, whatever
 * conditions the resolving runtime declares for the latter), and a package that only exposes
 * conditions neither uses — confirmed in practice with rime's own `"."` export, `types`/
 * `svelte`/`import` only, no `"require"`/`"default"` fallback — fails to resolve even its own
 * main entry through either API. This sidesteps that entirely: `node_modules/<pkgName>` is a
 * real directory (or, under pnpm, a real symlink `fs.existsSync` follows transparently)
 * regardless of what that package's `exports` map declares.
 */
export function findInstalledPackageRoot(pkgName: string, fromDir: string): string {
  let dir = fromDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', pkgName);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `$rime/modules: could not find installed package '${pkgName}' above ${fromDir}`
      );
    }
    dir = parent;
  }
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
 * Used by the Vite plugin's `resolveId`/`load` for on-demand resolution of a `$rime/modules`
 * self-reference; `scanModulePairs` below (a real walk) stays reserved for the barrel (which
 * needs every pair at once) and type generation.
 */
export function findModulePair(root: string, name: string): RuntimeRegistryEntry | null {
  const dir = path.join(root, name);
  const client = findModuleFile(dir, 'module');
  const server = findModuleFile(dir, 'module.server');
  return client || server ? { client: client ?? '', server: server ?? '' } : null;
}

/**
 * Recursively finds every `module`/`module.server` folder under `root`, registered under the
 * containing folder's path relative to `root` — e.g. `fields/relation/module.ts` under a
 * `src/lib`-rooted scan registers as `fields/relation`. Used by the `$rime/modules` barrel
 * (live, dev-mode only) and by `generate-manifest` (once, at prepack, scanning `dist/`).
 *
 * A pair sitting directly in `root` itself (e.g. `src/lib/module.ts`, no subfolder) registers
 * under the key `.` — same convention `package.json`'s own `exports` map uses for a package's
 * root, and a folder literally named `.` can't exist, so it can never collide with a real one.
 *
 * Either file alone is enough to register (single-sided is legitimate — a server-only piece,
 * e.g. a collection's hooks, never needs a hand-written client stub; the missing side is just
 * an empty string here, same convention `findModulePair` above uses). `rime.generated/` is
 * skipped since it's sanitize's own output, unrelated to this.
 */
export function scanModulePairs(root: string): RuntimeRegistry {
  const registry: RuntimeRegistry = new Map();
  if (!fs.existsSync(root)) return registry;

  const register = (dir: string, key: string) => {
    const client = findModuleFile(dir, 'module');
    const server = findModuleFile(dir, 'module.server');
    if (client || server) {
      registry.set(key, { client: client ?? '', server: server ?? '' });
    }
  };

  register(root, '.');

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === OUTPUT_DIR) continue;
      const fullPath = path.join(dir, entry.name);
      register(fullPath, path.relative(root, fullPath).split(path.sep).join('/'));
      walk(fullPath);
    }
  };
  walk(root);

  return registry;
}
