import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger.server.js';
import {
  applyEdits,
  buildModuleIndex,
  planBarrelRewrite,
  type ModuleIndex
} from '../../codegen/runtime/barrel-rewrite.server.js';
import { scanModulePairs, type RuntimeRegistry } from '../../codegen/runtime/index.server.js';
import { getPackageInfoByKey } from '../util/package.server.js';

/**
 * Run at prepack, after `svelte-package` (operates on the compiled `dist/`, not `src/lib`) —
 * makes this package's own `$rime/modules` splits consumable by anyone who installs it:
 *
 * 1. Builds an export-name → split index from every module.(server.)js pair under `dist/`,
 *    validating it as it goes — a name that resolves ambiguously has no correct rewrite target
 *    in step 2, so this has to fail loudly here, not silently later.
 * 2. Rewrites every `import ... from '$rime/modules'` found anywhere under `dist/` into one
 *    `import ... from '$rime/modules/<pkg>/<subpath>'` per split it actually draws from — the
 *    bare barrel form never survives past this step.
 *
 * Steps 1 and 2 are `codegen/runtime/barrel-rewrite.server.ts`, shared with the dev Vite
 * plugin, which does the same rewrite per module as it transforms. That sharing is the point:
 * the failure this rewrite prevents is one that reproduces in only one of the two.
 * 3. Writes `dist/.rime-modules.json` (subpath → real file paths, read directly by a
 *    consumer's Vite plugin — no fs.existsSync probing, no guessing) and
 *    `dist/.rime-modules.d.ts` (one `declare module '$rime/modules/<pkg>/<subpath>'` per
 *    split, referenced by a consumer's generated types).
 */
export const generateManifest = () => {
  const pkgName = getPackageInfoByKey('name');
  if (!pkgName) {
    throw new Error(
      "$rime generate-manifest: could not read this package's own name from package.json"
    );
  }

  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(
      `$rime generate-manifest: no dist/ at ${distDir} — run this after svelte-package, not before`
    );
  }

  const pairs = scanModulePairs(distDir);
  const index = buildModuleIndex(pairs, (subpath, onlyServer, onlyClient) =>
    logger.debug(
      `$rime/modules: ${subpath} — module.ts and module.server.ts export different names ` +
        `(server-only: ${onlyServer.join(', ') || 'none'}, client-only: ${onlyClient.join(', ') || 'none'})`
    )
  );

  rewriteBarrelImports(distDir, pkgName, index);
  writeManifest(distDir, pkgName, pairs);

  logger.info(`[✓] $rime/modules manifest generated for ${pkgName} (${pairs.size} split(s))`);
};

/**
 * `dist/.rime-modules.json` (runtime, read by a consumer's Vite plugin) and
 * `dist/.rime-modules.d.ts` (types, referenced by a consumer's generated types).
 *
 * Both store paths *relative to `distDir`*, not absolute — confirmed in practice that an
 * absolute path here is a real bug, not just a style choice: it bakes in wherever `dist/`
 * happened to sit on the machine that ran `generate-manifest`, and a consumer's Vite plugin
 * (`vite/index.server.ts`'s `load()`, third-party qualified form) re-joins it onto the
 * *installed* package's own root (`findInstalledPackageRoot`) at read time. On a real install
 * that absolute path wouldn't even exist; on the same dev machine the package was authored on
 * it silently reads the author's own working-copy `dist/` instead of what's actually installed
 * in the consumer's `node_modules` - stale-looking field/behavior drift with no error raised.
 *
 * The `.d.ts` needs a *different* relative shape than the runtime manifest, verified directly
 * (a real `tsc` run — a plain filesystem path, absolute or relative, silently resolves to zero
 * exports inside a `declare module` block; only a bare package-qualified specifier, resolved
 * through the same `node_modules` mechanism a real import would use, actually works): every
 * `export *` target is `<pkgName>/dist/<subpath-relative-to-dist>`.
 */
function writeManifest(distDir: string, pkgName: string, pairs: RuntimeRegistry) {
  const manifest: Record<string, { client?: string; server?: string }> = {};
  const dts: string[] = [];

  const relativeToDist = (target: string) =>
    path.relative(distDir, target).split(path.sep).join('/');

  for (const [subpath, entry] of pairs) {
    manifest[subpath] = {
      client: entry.client ? relativeToDist(entry.client) : undefined,
      server: entry.server ? relativeToDist(entry.server) : undefined
    };
    const target = entry.server || entry.client;
    const bareSpecifier = `${pkgName}/dist/${relativeToDist(target)}`.replace(/\.ts$/, '.js');
    dts.push(
      `declare module '$rime/modules/${pkgName}/${subpath}' {\n  export * from '${bareSpecifier}';\n}`
    );
  }

  fs.writeFileSync(path.join(distDir, '.rime-modules.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(distDir, '.rime-modules.d.ts'), dts.join('\n\n') + '\n');
}

/**
 * Walks every `.js`/`.d.ts` file under `dist/`, rewriting `import ... from '$rime/modules'`
 * into one `import ... from '$rime/modules/<pkg>/<subpath>'` per split its specifiers actually
 * draw from — a single barrel import can (and often will) pull names from several different
 * splits at once, each becoming its own import statement.
 *
 * Every rewritten `.d.ts` file also gets a `/// <reference path="...">` to `.rime-modules.d.ts`
 * prepended, making it self-contained — verified directly (a real `tsc` run): without it, a
 * consumer never discovers the ambient `declare module '$rime/modules/<pkg>/...'` declarations
 * at all, *even from a file inside this same package*, since nothing imports `.rime-modules.d.ts`
 * and it's outside any project's own `include`. Doing it here means the *consumer* never needs
 * to know this package exists just to get its types working — no eager, app-side aggregation
 * of every installed rime-dependent package required.
 */
function rewriteBarrelImports(distDir: string, pkgName: string, index: ModuleIndex) {
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.js') && !entry.name.endsWith('.d.ts')) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      // No `side` here, and there cannot be one: this runs once for a package that has not been
      // built for either side yet. The consumer's own plugin picks the half at load time, so a
      // name only one half declares is checked there, in the build that actually needs it.
      const edits = planBarrelRewrite({ code: content, filePath: fullPath, pkgName, index });
      if (!edits.length) continue;

      const code = applyEdits(content, edits);
      fs.writeFileSync(
        fullPath,
        entry.name.endsWith('.d.ts') ? withManifestReference(code, fullPath, distDir) : code
      );
    }
  };
  walk(distDir);
}

function withManifestReference(code: string, fullPath: string, distDir: string): string {
  const relative = path
    .relative(path.dirname(fullPath), path.join(distDir, '.rime-modules.d.ts'))
    .split(path.sep)
    .join('/');
  const referencePath = relative.startsWith('.') ? relative : `./${relative}`;
  return `/// <reference path="${referencePath}" />\n${code}`;
}
