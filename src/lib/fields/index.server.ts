import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { existsSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'path';

export type ToType<T extends FieldBuilder<any> = FieldBuilder<any>> = (
  field: T
) => Promise<string> | string;

/**
 * Converts a file URL to its corresponding server module path and checks if the file exists.
 * Prefers a sibling `module.server.ts` — the one canonical location for a field's server-only
 * surface (toType + its `$rime/<name>` hook, see relation/ for the reference shape) — falling
 * back to the older `<basename>.server.ts` convention fields not yet migrated still use (e.g.
 * number/index.server.ts). New fields should only ever use module.server.ts; the fallback exists
 * for backward compatibility, not as a second valid option. Tries both .ts and .js extensions
 * either way.
 * @example
 * convertToServerModulePath('file:///path/to/relation/index.ts') // '/path/to/relation/module.server.ts'
 * convertToServerModulePath('file:///path/to/text/index.ts') // '/path/to/text/index.server.ts'
 */
function convertToServerModulePath(metaUrl: string): string | null {
  try {
    // Convert file:// URL to file path
    const filePath = fileURLToPath(metaUrl);
    const dir = dirname(filePath);

    // Get the filename without extension
    const baseName = filePath.replace(extname(filePath), '');

    const candidates = [join(dir, 'module.server'), `${baseName}.server`];

    for (const candidate of candidates) {
      for (const ext of ['.ts', '.js']) {
        const fullPath = `${candidate}${ext}`;
        if (existsSync(fullPath)) {
          return fullPath;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error converting metaUrl to server module path:', error);
    return null;
  }
}

/**
 * Dynamically imports the server-side module for a form field if it exists
 * Returns the imported module or false if no server module is found or import fails
 * @example
 * const serverModule = await getFieldPrivateModule(fieldBuilder);
 * if (serverModule) {
 *   serverModule.toType(fieldBuilder)
 * }
 */
export async function getFieldPrivateModule(
  field: FieldBuilder<any>
): Promise<{ toType: ToType } | null> {
  if (field._metaUrl) {
    const serverModulePath = convertToServerModulePath(field._metaUrl);

    if (serverModulePath) {
      try {
        const serverField = await import(/* @vite-ignore */ serverModulePath);
        return serverField;
      } catch (error) {
        console.error('Error importing server module:', error);
        return null;
      }
    } else {
      console.warn('Server module not found for:', field._metaUrl);
      return null;
    }
  }
  return null;
}
