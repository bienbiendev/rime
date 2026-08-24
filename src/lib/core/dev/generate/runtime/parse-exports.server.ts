import { babelParse } from 'ast-kit';
import * as t from '@babel/types';
import fs from 'node:fs';

/**
 * Top-level named + default export identifiers of a module — used by the Vite plugin's
 * `exportFrom()` to stub out a side of a `$rime/<name>` pair that wasn't authored (e.g. a
 * collection's server-only hook, requested by a client build), matching the real side's
 * export names so ESM's static named-export binding doesn't throw at link time.
 */
export function parseExportNames(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ast = babelParse(content, 'ts', { sourceType: 'module', attachComment: false });
  const names: string[] = [];

  for (const node of ast.body) {
    if (t.isExportNamedDeclaration(node)) {
      if (node.declaration) {
        if (t.isVariableDeclaration(node.declaration)) {
          for (const decl of node.declaration.declarations) {
            if (t.isIdentifier(decl.id)) names.push(decl.id.name);
          }
        } else if (
          'id' in node.declaration &&
          node.declaration.id &&
          t.isIdentifier(node.declaration.id)
        ) {
          names.push(node.declaration.id.name);
        }
      }
      for (const spec of node.specifiers) {
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
