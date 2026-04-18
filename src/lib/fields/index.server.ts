import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { existsSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { extname } from 'path';

export type ToType<T extends FieldBuilder<any> = FieldBuilder<any>> = (
  field: T
) => Promise<string> | string;
export type ToSchema<T extends FieldBuilder<any> = FieldBuilder<any>> = (
  field: T,
  parentPath?: string
) => string;

/**
 * Converts a file URL to its corresponding server module path and checks if the file exists
 * Tries both .ts and .js extensions to find the server module
 * @example
 * convertToServerModulePath('file:///path/to/field.ts') // returns '/path/to/field.server.ts' if exists
 */
function convertToServerModulePath(metaUrl: string): string | null {
  try {
    // Convert file:// URL to file path
    const filePath = fileURLToPath(metaUrl);

    // Get the filename without extension
    const baseName = filePath.replace(extname(filePath), '');

    // Create the server module path
    const serverModulePath = `${baseName}.server`;

    // Try .ts first, then .js
    for (const ext of ['.ts', '.js']) {
      const fullPath = `${serverModulePath}${ext}`;
      if (existsSync(fullPath)) {
        return fullPath;
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
 *   serverModule.toSchema({ name: 'title' })
 *   serverModule.toSchema({ name: 'title' })
 * }
 */
export async function getFieldPrivateModule(
  field: FieldBuilder<any>
): Promise<{ toType: ToType; toSchema: ToSchema } | null> {
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
