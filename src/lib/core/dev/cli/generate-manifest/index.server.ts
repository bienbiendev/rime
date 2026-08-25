import { generate } from '@babel/generator';
import * as t from '@babel/types';
import { babelParse } from 'ast-kit';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger/index.server.js';
import { scanModulePairs, type RuntimeRegistry } from '../../generate/runtime/index.server.js';
import { parseExportNames } from '../../generate/runtime/parse-exports.server.js';
import { getPackageInfoByKey } from '../util/package.server.js';

/**
 * Run at prepack, after `svelte-package` (operates on the compiled `dist/`, not `src/lib`) —
 * makes this package's own `$rime/modules` splits consumable by anyone who installs it:
 *
 * 1. Builds an export-name → split index from every module.(server.)js pair under `dist/`,
 *    validating it as it goes (see `buildModuleIndex` below) — a name that resolves
 *    ambiguously has no correct rewrite target in step 2, so this has to fail loudly here,
 *    not silently later.
 * 2. AST-rewrites every `import ... from '$rime/modules'` found anywhere under `dist/` into
 *    one `import ... from '$rime/modules/<pkg>/<subpath>'` per split it actually draws from —
 *    the bare barrel form never survives past this step.
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
  const nameOwner = buildModuleIndex(pairs);

  rewriteBarrelImports(distDir, pkgName, nameOwner);
  writeManifest(distDir, pkgName, pairs);

  logger.info(`[✓] $rime/modules manifest generated for ${pkgName} (${pairs.size} split(s))`);
};

/**
 * Export-name → split index, with the two collision scenarios from the design doc handled
 * distinctly:
 * - module.ts and module.server.ts of the *same* split sharing a name — not a collision, that's
 *   the whole point of a pair (skip, both sides collapse to one entry). The two sides don't
 *   need to export the *same set* of names either — a server-only helper the client build
 *   never needs (e.g. cache's own `toHash`) is completely normal, not a broken pair; indexed
 *   from the union of both sides, worth a log for visibility, never a blocking error.
 * - two *different* splits exporting the same name — the actual collision. An ambiguous
 *   `$rime/modules` import has no correct rewrite target, so this is a hard error here, not a
 *   warning: it has to be caught before the rewrite runs, not after.
 */
function buildModuleIndex(pairs: RuntimeRegistry): Map<string, string> {
  const nameOwner = new Map<string, string>();

  for (const [subpath, entry] of pairs) {
    const serverNames = entry.server ? parseExportNames(entry.server) : [];
    const clientNames = entry.client ? parseExportNames(entry.client) : [];

    if (entry.server && entry.client) {
      const serverSet = new Set(serverNames);
      const clientSet = new Set(clientNames);
      const onlyServer = serverNames.filter((name) => !clientSet.has(name));
      const onlyClient = clientNames.filter((name) => !serverSet.has(name));
      if (onlyServer.length || onlyClient.length) {
        logger.debug(
          `$rime/modules: ${subpath} — module.ts and module.server.ts export different names ` +
            `(server-only: ${onlyServer.join(', ') || 'none'}, client-only: ${onlyClient.join(', ') || 'none'})`
        );
      }
    }

    const names = new Set([...serverNames, ...clientNames]);
    for (const name of names) {
      const existing = nameOwner.get(name);
      if (existing && existing !== subpath) {
        throw new Error(`$rime/modules: "${name}" exported by both ${existing} and ${subpath}`);
      }
      nameOwner.set(name, subpath);
    }
  }

  return nameOwner;
}

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
function rewriteBarrelImports(distDir: string, pkgName: string, nameOwner: Map<string, string>) {
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.js') && !entry.name.endsWith('.d.ts')) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      if (!content.includes('$rime/modules')) continue;

      const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: true });
      let changed = false;
      const newBody: t.Statement[] = [];

      for (const node of ast.body) {
        // `import { x } from '$rime/modules'` (runtime .js) and the equivalent re-export
        // `export { x } from '$rime/modules'` (declaration .d.ts, what tsc/svelte-package
        // actually emits — a real end-to-end run caught this, not something guessable) both
        // need the same treatment.
        if (t.isImportDeclaration(node) && node.source.value === '$rime/modules') {
          changed = true;
          newBody.push(...splitBarrelImport(node, fullPath, pkgName, nameOwner));
          continue;
        }
        if (t.isExportNamedDeclaration(node) && node.source?.value === '$rime/modules') {
          changed = true;
          newBody.push(...splitBarrelReExport(node, fullPath, pkgName, nameOwner));
          continue;
        }
        if (t.isExportAllDeclaration(node) && node.source.value === '$rime/modules') {
          throw new Error(
            `$rime/modules: ${fullPath} does 'export * from $rime/modules' — ambiguous, can't tell which split each re-exported name belongs to. Import/re-export specific names instead.`
          );
        }
        newBody.push(node);
      }

      if (changed) {
        ast.body = newBody;
        const { code } = generate(ast, { compact: false, comments: true });
        fs.writeFileSync(
          fullPath,
          entry.name.endsWith('.d.ts') ? withManifestReference(code, fullPath, distDir) : code
        );
      }
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

/** `import { x } from '$rime/modules'` (runtime .js) — groups specifiers by which split each
 *  name actually belongs to (via `nameOwner`, built by `buildModuleIndex`), one import
 *  statement per split. */
function splitBarrelImport(
  node: t.ImportDeclaration,
  fullPath: string,
  pkgName: string,
  nameOwner: Map<string, string>
): t.ImportDeclaration[] {
  const bySubpath = new Map<string, t.ImportSpecifier[]>();

  for (const spec of node.specifiers) {
    if (!t.isImportSpecifier(spec)) {
      throw new Error(
        `$rime/modules: ${fullPath} imports the barrel with a default/namespace specifier — only named imports are supported`
      );
    }
    const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
    const subpath = nameOwner.get(importedName);
    if (!subpath) {
      throw new Error(
        `$rime/modules: '${importedName}' imported in ${fullPath} but not exported by any split`
      );
    }
    if (!bySubpath.has(subpath)) bySubpath.set(subpath, []);
    bySubpath.get(subpath)!.push(spec);
  }

  return Array.from(bySubpath.entries()).map(([subpath, specs]) =>
    t.importDeclaration(specs, t.stringLiteral(`$rime/modules/${pkgName}/${subpath}`))
  );
}

/** `export { x } from '$rime/modules'` — what `tsc`/`svelte-package` actually emits in `.d.ts`
 *  output (a real end-to-end run caught this; `import`+`export` pairs aren't the only shape).
 *  Same grouping as `splitBarrelImport`, just keyed off `.local` (the name as it exists in the
 *  source module) instead of `.imported` — `ExportSpecifier` doesn't have that field. */
function splitBarrelReExport(
  node: t.ExportNamedDeclaration,
  fullPath: string,
  pkgName: string,
  nameOwner: Map<string, string>
): t.ExportNamedDeclaration[] {
  const bySubpath = new Map<string, t.ExportSpecifier[]>();

  for (const spec of node.specifiers) {
    if (!t.isExportSpecifier(spec)) {
      throw new Error(
        `$rime/modules: ${fullPath} re-exports the barrel with a default/namespace specifier — only named exports are supported`
      );
    }
    const localName = spec.local.name;
    const subpath = nameOwner.get(localName);
    if (!subpath) {
      throw new Error(
        `$rime/modules: '${localName}' re-exported in ${fullPath} but not exported by any split`
      );
    }
    if (!bySubpath.has(subpath)) bySubpath.set(subpath, []);
    bySubpath.get(subpath)!.push(spec);
  }

  return Array.from(bySubpath.entries()).map(([subpath, specs]) =>
    t.exportNamedDeclaration(null, specs, t.stringLiteral(`$rime/modules/${pkgName}/${subpath}`))
  );
}
