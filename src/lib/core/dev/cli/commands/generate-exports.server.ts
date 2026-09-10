import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger.server.js';
import { scanModulePairs, type RuntimeRegistry } from '../../codegen/runtime/index.server.js';
import { parseExportNames } from '../../codegen/runtime/parse-exports.server.js';
import { getPackageInfoByKey } from '../util/package.server.js';

const SPECIFIER = '$rime/modules:';

/**
 * Run at prepack, after `svelte-package` — makes this package's `$rime/modules:` splits work for
 * anyone who installs it.
 *
 * In this package's own repo the Vite plugin answers those imports from `src/lib`. An installed
 * copy has no such plugin, so prepack turns each one into an ordinary package subpath and adds
 * the `exports` entry that resolves it per environment:
 *
 * ```js
 * // dist/core/prototype/collection/definition.js
 * import { augmentAuth } from '$rime/modules:core/auth';   // before
 * import { augmentAuth } from 'rimecms/core/auth/module';  // after
 * ```
 * ```jsonc
 * "./core/auth/module": {
 *   "browser": "./dist/core/auth/module.js",
 *   "default": "./dist/core/auth/module.server.js"
 * }
 * ```
 *
 * A subpath written into a real `dist` file is followed by esbuild while it pre-bundles the
 * package, so the half it picks lands *inside* that bundle. The absolute `node_modules` path this
 * replaces did not — it left half of rime's client graph outside the bundler, CommonJS and all
 * (see docs/isomorphic-module.md).
 */
export const generateExports = () => {
  const pkgName = getPackageInfoByKey('name');
  if (!pkgName) {
    throw new Error(
      "$rime/modules: could not read this package's own name from package.json — the rewrite " +
        'has no package to qualify its imports with'
    );
  }

  const root = process.cwd();
  const distDir = path.resolve(root, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(
      `$rime/modules: no dist/ at ${distDir} — run this after svelte-package, not before`
    );
  }

  const pairs = scanModulePairs(distDir);
  const stubs = writeClientStubs(distDir, pairs);
  rewriteSpecifiers(distDir, pkgName, pairs);
  writeExports(root, distDir, pairs, stubs);

  logger.info(`[✓] $rime/modules: ${pairs.size} split(s) exported for ${pkgName}`);
};

/** `<subpath>` -> `./dist/...` as `exports` wants it, forward slashes on every platform. */
const asExportTarget = (distDir: string, file: string) =>
  './' + path.relative(path.dirname(distDir), file).split(path.sep).join('/');

/**
 * A server-only pair still has to answer on the client, where its names read `undefined` — the
 * shape a half pair has always had. A condition needs a file to point at, so the stub that used to
 * be synthesised at request time is written out here.
 *
 * ESM binds named exports statically, so an empty module is not enough: `import { x }` throws a
 * SyntaxError at link time if `x` is absent rather than lazily reading `undefined`.
 */
function writeClientStubs(distDir: string, pairs: RuntimeRegistry) {
  const stubs = new Map<string, string>();

  for (const [subpath, entry] of pairs) {
    if (entry.client || !entry.server) continue;

    const stubPath = path.join(distDir, subpath, 'module.browser.js');
    const body = parseExportNames(entry.server)
      .map((name) =>
        name === 'default' ? 'export default undefined;' : `export const ${name} = undefined;`
      )
      .join('\n');
    fs.writeFileSync(stubPath, `${body}\n`);
    stubs.set(subpath, stubPath);
  }

  return stubs;
}

/** Every `$rime/modules:<path>` under dist/ becomes `<pkg>/<subpath>/module`. */
function rewriteSpecifiers(distDir: string, pkgName: string, pairs: RuntimeRegistry) {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|d\.ts)$/.test(entry.name)) files.push(full);
    }
  };
  walk(distDir);

  // Anchored to a statement, not just the string: a doc comment's example line starts with `*`,
  // and `declare module '$rime/modules:…'` in a generated .d.ts starts with `declare` — neither
  // is an import, and rewriting either would be wrong.
  const pattern =
    /^([ \t]*(?:import|export)\b[^;\n]*?from[ \t]*)(['"])\$rime\/modules:([^'"]*)\2/gm;

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    if (!code.includes(SPECIFIER)) continue;

    const rewritten = code.replace(pattern, (_match, head: string, quote: string, spec: string) => {
      const base = spec.startsWith('.')
        ? path.resolve(path.dirname(file), spec)
        : path.resolve(distDir, spec);
      const subpath = path.relative(distDir, base).split(path.sep).join('/');
      if (!pairs.has(subpath)) {
        throw new Error(
          `$rime/modules:${spec} in ${path.relative(distDir, file)} names no pair — ` +
            `nothing at dist/${subpath}/module(.server).js`
        );
      }
      return `${head}${quote}${pkgName}/${subpath}/module${quote}`;
    });

    // Anything left in an import position is a shape the pattern above does not handle — a
    // dynamic `import()`, a bare side-effect import. Better to stop here than to ship a
    // specifier no consumer can resolve.
    const missed = rewritten
      .split('\n')
      .find((line) => /^[ \t]*(?:import|export)\b/.test(line) && line.includes(SPECIFIER));
    if (missed) {
      throw new Error(
        `${path.relative(distDir, file)}: \`${missed.trim()}\` was not rewritten — ` +
          'only static `from` imports are supported'
      );
    }

    fs.writeFileSync(file, rewritten);
  }
}

/**
 * One `exports` entry per pair, plus the two fixes every pre-existing entry needs.
 *
 * `browser` has to come before `svelte`: vite-plugin-svelte applies `svelte` to both environments,
 * conditions are first-match-wins, and an entry led by `svelte` therefore hands the client build
 * the server half. And an entry with no `default` fails to resolve through the map at all.
 */
function writeExports(
  root: string,
  distDir: string,
  pairs: RuntimeRegistry,
  stubs: Map<string, string>
) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const exportsMap: Record<string, unknown> = pkg.exports ?? {};

  // Idempotent: this command runs on every prepack, and a pair that disappeared must not leave
  // its entry behind pointing at a file dist/ no longer has.
  for (const key of Object.keys(exportsMap)) {
    if (key.endsWith('/module')) delete exportsMap[key];
  }

  for (const [subpath, entry] of pairs) {
    const client = entry.client || stubs.get(subpath);
    const server = entry.server;
    const types = (server || entry.client)!.replace(/\.js$/, '.d.ts');

    exportsMap[`./${subpath}/module`] = {
      ...(fs.existsSync(types) ? { types: asExportTarget(distDir, types) } : {}),
      ...(client ? { browser: asExportTarget(distDir, client) } : {}),
      default: asExportTarget(distDir, (server || entry.client)!)
    };
  }

  for (const [key, value] of Object.entries(exportsMap)) {
    if (key.endsWith('/module') || typeof value !== 'object' || value === null) continue;
    const conditions = value as Record<string, string>;
    if (!conditions.default && conditions.import) conditions.default = conditions.import;
  }

  pkg.exports = exportsMap;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
