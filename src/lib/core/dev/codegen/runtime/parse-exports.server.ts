import { babelParse } from 'ast-kit';
import * as t from '@babel/types';
import fs from 'node:fs';

/**
 * Top-level named + default export identifiers of a module — the export-name index every
 * `$rime/modules` mechanism is built on: the Vite plugin's per-name rewrite, its `exportFrom()`
 * stubbing of a side that wasn't authored, and `generate-manifest`'s prepack rewrite.
 *
 * **Values only.** A type export has no runtime existence, so collecting one is never right: it
 * would be stubbed as `export const Foo = undefined` on a missing side, and indexed as a name a
 * rewrite could target. Three shapes carry a type and each needs its own guard, because babel
 * spells them differently:
 *
 * - `export type Foo = …` / `export interface Foo {}` — a type *declaration*, which reaches the
 *   `'id' in node.declaration` branch below looking exactly like a function or a class.
 * - `export type { Foo }` — `node.exportKind === 'type'` on the whole statement.
 * - `export { type Foo, bar }` — `spec.exportKind === 'type'` on the individual specifier.
 */
export function parseExportNames(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });
  const names: string[] = [];

  for (const node of ast.body) {
    if (t.isExportNamedDeclaration(node)) {
      // `export type { Foo }` — the whole statement is type-only.
      if (node.exportKind === 'type') continue;

      if (node.declaration) {
        if (t.isVariableDeclaration(node.declaration)) {
          for (const decl of node.declaration.declarations) {
            if (t.isIdentifier(decl.id)) names.push(decl.id.name);
          }
        } else if (
          // A type alias or an interface declares an `id` just like a function does, so the
          // shape test below cannot tell them apart — these two are the discriminator.
          !t.isTSTypeAliasDeclaration(node.declaration) &&
          !t.isTSInterfaceDeclaration(node.declaration) &&
          'id' in node.declaration &&
          node.declaration.id &&
          t.isIdentifier(node.declaration.id)
        ) {
          names.push(node.declaration.id.name);
        }
      }
      for (const spec of node.specifiers) {
        // `export { type Foo, bar }` — only this specifier is type-only.
        if (t.isExportSpecifier(spec) && spec.exportKind === 'type') continue;
        if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
          names.push(spec.exported.name);
        }
      }
    }
    if (t.isExportDefaultDeclaration(node)) {
      names.push('default');
    }
  }

  return names;
}
