import * as t from '@babel/types';
import { babelParse } from 'ast-kit';
import type { RuntimeRegistry } from './index.server.js';
import { parseExportNames } from './parse-exports.server.js';

/**
 * Turning `import { x } from '$rime/modules'` into an import of the one pair that declares `x`.
 *
 * Both places that need this do the same thing for the same reason, so they share it: the dev
 * Vite plugin does it per module as it transforms, and `generate-manifest` does it across
 * `dist/` at prepack. Dev and dist producing *the same* rewrite is the point — the class of bug
 * this exists to prevent is one that only reproduces in one of them.
 *
 * The bare specifier is a whole-package barrel: it re-exports every `module(.server).ts` pair,
 * so importing one binding imports all of them and everything they import. That is what made a
 * feature evaluate inside an import cycle and capture `undefined` at module scope. Rewriting per
 * name removes the barrel from the module graph entirely — one pair in, nothing else.
 */

export type Side = 'client' | 'server';

export type ModuleIndexEntry = {
  /** The pair this name belongs to, as `scanModulePairs` keys it. */
  subpath: string;
  /** Whether each half *declares this name*. */
  inClient: boolean;
  inServer: boolean;
  /** Whether the pair *has each half at all* — a different question, and the one that decides
   *  whether a missing name is an error or a legitimate `undefined` stub. See `resolveForSide`. */
  pairHasClient: boolean;
  pairHasServer: boolean;
};

export type ModuleIndex = Map<string, ModuleIndexEntry>;

/**
 * Export name → the pair that declares it.
 *
 * Two collision scenarios, handled distinctly:
 *
 * - The two halves of the *same* pair sharing a name — not a collision, that is the whole point
 *   of a pair. They need not declare the same *set* either: a server-only helper the client
 *   never needs (`core/plugins/cache`'s `toHash`) is normal. Legal, reported through
 *   `onAsymmetry`, never fatal.
 * - Two *different* pairs exporting the same name — the real collision. A rewrite would have no
 *   single correct target, so it fails here, before any rewriting happens.
 */
export function buildModuleIndex(
  pairs: RuntimeRegistry,
  onAsymmetry?: (subpath: string, onlyServer: string[], onlyClient: string[]) => void
): ModuleIndex {
  const index: ModuleIndex = new Map();

  for (const [subpath, entry] of pairs) {
    const serverNames = entry.server ? parseExportNames(entry.server) : [];
    const clientNames = entry.client ? parseExportNames(entry.client) : [];
    const serverSet = new Set(serverNames);
    const clientSet = new Set(clientNames);

    if (entry.server && entry.client && onAsymmetry) {
      const onlyServer = serverNames.filter((name) => !clientSet.has(name));
      const onlyClient = clientNames.filter((name) => !serverSet.has(name));
      if (onlyServer.length || onlyClient.length) onAsymmetry(subpath, onlyServer, onlyClient);
    }

    for (const name of new Set([...serverNames, ...clientNames])) {
      const existing = index.get(name);
      if (existing && existing.subpath !== subpath) {
        throw new Error(
          `$rime/modules: "${name}" exported by both ${existing.subpath} and ${subpath}`
        );
      }
      index.set(name, {
        subpath,
        inClient: clientSet.has(name),
        inServer: serverSet.has(name),
        pairHasClient: !!entry.client,
        pairHasServer: !!entry.server
      });
    }
  }

  return index;
}

/**
 * Whether a name is usable from `side`, and if not, why not — the distinction that decides
 * between a hard error and a legitimate `undefined`.
 *
 * - The pair has this side's half, and it declares the name → fine.
 * - The pair has **no** half for this side at all → the name resolves to `undefined` there, by
 *   design. `exportFrom` stubs it, and isomorphic code that imports a server-only hook without
 *   ever calling it client-side depends on exactly this (`features/url`).
 * - The pair **has** this side's half and that half does not declare the name → a real gap.
 *   Today this surfaces as a `SyntaxError` in the browser at link time; naming it here makes it
 *   a build error pointing at the importing file instead.
 */
function resolveForSide(entry: ModuleIndexEntry, side: Side): 'ok' | 'stubbed' | 'missing' {
  const declares = side === 'server' ? entry.inServer : entry.inClient;
  const pairHasSide = side === 'server' ? entry.pairHasServer : entry.pairHasClient;

  if (declares) return 'ok';
  return pairHasSide ? 'missing' : 'stubbed';
}

/** A splice to apply to the source: replace `[start, end)` with `replacement`. */
export type BarrelEdit = { start: number; end: number; replacement: string };

type PlanArgs = {
  code: string;
  /** Only used in error messages, to point at the file doing the importing. */
  filePath: string;
  /** The package whose `src/lib` (dev) or `dist/` (prepack) the pairs were scanned from. */
  pkgName: string;
  index: ModuleIndex;
  /**
   * The build side, when it is known.
   *
   * The dev transform knows it and passes it, which is what turns a name the requested half
   * does not declare into an error here. `generate-manifest` runs once at prepack for both
   * sides at once, so it cannot check this — the consumer's own plugin picks the side at load.
   */
  side?: Side;
};

/**
 * The edits that rewrite every bare `$rime/modules` import in one file. Empty when there are
 * none — callers skip the work rather than rewriting a file to itself.
 *
 * Returned as splices rather than a regenerated AST so the rest of the file survives byte for
 * byte: no reformatting, no lost comments, and the replacement for one statement stays on one
 * line, which keeps every other line number where it was.
 */
export function planBarrelRewrite({
  code,
  filePath,
  pkgName,
  index,
  side
}: PlanArgs): BarrelEdit[] {
  if (!code.includes(BARREL)) return [];

  const ast = babelParse(code, 'ts', { sourceType: 'module', attachComment: false });
  const edits: BarrelEdit[] = [];

  for (const node of ast.body) {
    // `import { x } from '$rime/modules'` — source files and compiled `.js`.
    if (t.isImportDeclaration(node) && node.source.value === BARREL) {
      const names = node.specifiers.map((spec) => {
        if (!t.isImportSpecifier(spec)) throw namespaceImportError(filePath);
        return t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
      });
      edits.push(edit(node, group(names, node.specifiers, filePath, index, side), 'import', pkgName));
      continue;
    }

    // `export { x } from '$rime/modules'` — what tsc/svelte-package emits into `.d.ts`. Same
    // grouping, keyed off `.local`: an ExportSpecifier has no `.imported`.
    if (t.isExportNamedDeclaration(node) && node.source?.value === BARREL) {
      const names = node.specifiers.map((spec) => {
        if (!t.isExportSpecifier(spec)) throw namespaceImportError(filePath);
        return spec.local.name;
      });
      edits.push(edit(node, group(names, node.specifiers, filePath, index, side), 'export', pkgName));
      continue;
    }

    // `export * from '$rime/modules'` — no way to tell which pair each re-exported name comes
    // from, so there is nothing to rewrite it into.
    if (t.isExportAllDeclaration(node) && node.source.value === BARREL) {
      throw new Error(
        `$rime/modules: ${filePath} does \`export * from '$rime/modules'\`. There is no per-name ` +
          `target for a star re-export — re-export the names you mean instead.`
      );
    }
  }

  assertNoDynamicImport(code, filePath);

  return edits;
}

const BARREL = '$rime/modules';

/** Groups the specifiers of one statement by the pair each name belongs to, and renders the
 *  replacement statements — one per pair, space-separated so the line count does not move. */
function group(
  names: string[],
  specifiers: (t.ImportSpecifier | t.ExportSpecifier | t.Node)[],
  filePath: string,
  index: ModuleIndex,
  side: Side | undefined
): Map<string, string[]> {
  const bySubpath = new Map<string, string[]>();

  names.forEach((name, i) => {
    const entry = index.get(name);
    if (!entry) {
      throw new Error(
        `$rime/modules: '${name}' is imported in ${filePath} but no module pair exports it.`
      );
    }

    if (side && resolveForSide(entry, side) === 'missing') {
      const half = side === 'server' ? 'module.server.ts' : 'module.ts';
      const other = side === 'server' ? 'module.ts' : 'module.server.ts';
      throw new Error(
        `$rime/modules: '${name}' is imported in ${filePath}, which is in the ${side} build, but ` +
          `${entry.subpath}/${half} does not export it — only ${entry.subpath}/${other} does.\n` +
          `A name is only stubbed as \`undefined\` when the pair has no ${half} at all. Since ` +
          `this pair has one, either declare '${name}' there too, or move it into its own ` +
          `${side}-only module.`
      );
    }

    const local = renderSpecifier(specifiers[i], names[i]);
    if (!bySubpath.has(entry.subpath)) bySubpath.set(entry.subpath, []);
    bySubpath.get(entry.subpath)!.push(local);
  });

  return bySubpath;
}

/** `x`, or `x as y` when the import is aliased. */
function renderSpecifier(spec: t.Node, name: string): string {
  if (t.isImportSpecifier(spec)) {
    return spec.local.name === name ? name : `${name} as ${spec.local.name}`;
  }
  if (t.isExportSpecifier(spec)) {
    const exported = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
    return exported === name ? name : `${name} as ${exported}`;
  }
  return name;
}

function edit(
  node: t.Node,
  bySubpath: Map<string, string[]>,
  kind: 'import' | 'export',
  pkgName: string
): BarrelEdit {
  const statements = Array.from(bySubpath.entries()).map(
    ([subpath, locals]) =>
      `${kind} { ${locals.join(', ')} } from '${BARREL}/${pkgName}/${subpath}';`
  );
  return { start: node.start!, end: node.end!, replacement: statements.join(' ') };
}

function namespaceImportError(filePath: string) {
  return new Error(
    `$rime/modules: ${filePath} imports the barrel with a namespace or default specifier ` +
      `(\`import * as m\` / \`import m\`). There is no per-name target for that — import the ` +
      `names you mean instead.`
  );
}

/**
 * `import('$rime/modules')` has no static specifier list, so there is nothing to rewrite it
 * into — and serving it the whole barrel is the blind import this rewrite exists to remove.
 *
 * Caught by source scan rather than AST walk on purpose: a dynamic import can appear anywhere
 * in a module, at any depth, and this only needs to say "don't".
 */
function assertNoDynamicImport(code: string, filePath: string) {
  if (/\bimport\s*\(\s*['"]\$rime\/modules['"]\s*\)/.test(code)) {
    throw new Error(
      `$rime/modules: ${filePath} imports the barrel dynamically. A dynamic import has no ` +
        `name list to resolve against — use a static import of the names you need.`
    );
  }
}

/** Applies edits right-to-left so earlier offsets stay valid. */
export function applyEdits(code: string, edits: BarrelEdit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((out, e) => out.slice(0, e.start) + e.replacement + out.slice(e.end), code);
}
