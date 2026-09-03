import { IS_RIME_REPO, PACKAGE_NAME } from '$lib/core/constants.server.js';
import cache from '$lib/core/dev/cache.server.js';
import type {
  BuiltArea,
  BuiltCollection,
  Config,
  ImageSizesConfig
} from '$lib/core/config/types.js';
import { isUploadConfig } from '$lib/core/features/upload/util/config.js';

import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { logger } from '$lib/core/logger.server.js';
import type { Field } from '$lib/fields/types.js';
import { trycatchSync } from '$lib/util/function.js';
import fs from 'node:fs';
import path from 'node:path';
import { GENERATED_DIR, relativeImportSpecifier } from '../../constants.server.js';
import {
  templateDeclareVirtualModule,
  templateDocType,
  templateLocals,
  templateRegister
} from './templates.server.js';

/**
 * Generates type definitions for image sizes
 * @returns A string containing the type definition for image sizes
 */
function generateImageSizesType(sizes: ImageSizesConfig[]) {
  const sizesTypes = sizes
    .map((size) => {
      if (size.out && size.out.length > 1) {
        return size.out.map((format) => `${size.name}_${format}: string`).join(', ');
      } else {
        return `${size.name}: string`;
      }
    })
    .join(', ');
  return `\n\t\tsizes:{${sizesTypes}}`;
}

/**
 * Generates the complete TypeScript type definitions string based on the built configuration
 * @returns A string containing all type definitions
 */
export async function generateTypesString<T extends Config>(config: T) {
  logger.info('Types generation...');
  const collections = (config.collections || []).filter((c) => c._generateTypes !== false);
  const areas = (config.areas || []).filter((c) => c._generateTypes !== false);

  // const registeredBlocks: string[] = [];
  // const registeredTreeBlocks: string[] = [];
  let imports = new Set<string>(['BaseDoc', 'Navigation', 'RouteHandlers', 'User']);

  const addImport = (string: string) => {
    imports = new Set([...imports, string]);
  };

  /**
   * Generates fields type definitions string based on a list of field
   * @returns An array of string containing fields type definitions
   */
  const buildFieldsTypes = async (fields: FieldBuilder<Field>[]): Promise<string[]> => {
    return fields.map((field) => field.use.generateType()).filter(Boolean);
  };

  const processCollection = async (collection: BuiltCollection) => {
    let fields = collection.fields;
    if (isUploadConfig(collection) && collection.upload.imageSizes?.length) {
      fields = collection.fields
        .filter((f) => f instanceof FormFieldBuilder)
        .filter((field) => !collection.upload.imageSizes!.some((size) => size.name === field.name));
    }
    const fieldsTypesList = await buildFieldsTypes(fields);
    if (collection.versions) {
      fieldsTypesList.push('versionId: string');
    }
    let fieldsContent = fieldsTypesList.join('\n\t');

    if (isUploadConfig(collection)) {
      addImport('UploadDoc');
      if (collection.upload.imageSizes?.length) {
        fieldsContent += generateImageSizesType(collection.upload.imageSizes);
      }
    }
    return templateDocType(collection.slug, fieldsContent, !!collection.upload);
  };

  const processArea = async (area: BuiltArea) => {
    const fieldsTypesList = await buildFieldsTypes(area.fields);
    if (area.versions) {
      fieldsTypesList.push('versionId: string');
    }
    return templateDocType(area.slug, fieldsTypesList.join('\n\t'));
  };

  const collectionsTypes = (await Promise.all(collections.map(processCollection))).join('\n');
  const areasTypes = (await Promise.all(areas.map(processArea))).join('\n');
  const typeImports = `import type { ${Array.from(imports).join(', ')} } from '${PACKAGE_NAME}/types'`;
  // app.generated.d.ts always sits at src/app.generated.d.ts (see generateTypes() below).
  const rimeConfigServerPath = relativeImportSpecifier(
    path.resolve(process.cwd(), 'src'),
    path.resolve(process.cwd(), GENERATED_DIR, 'rime.config.server.ts')
  );

  function parseSharedTypes(content: string): {
    content: string;
    shared: string;
  } {
    // Field builders emit reusable type definitions (e.g. BlocksBuilder's per-block
    // types) wrapped between `//@shared:start <name>` and `//@shared:end`, each on
    // its own line. Extracted once per name, deduped, and hoisted above the doc
    // types that reference them.
    const regex =
      /^[ \t]*\/\/@shared:start[ \t]+(\S+)[ \t]*\r?\n([\s\S]*?)^[ \t]*\/\/@shared:end[ \t]*$/gm;

    const seen = new Set<string>();
    const shared: string[] = [];

    const remainingContent = content.replace(regex, (_match, group1: string, group2: string) => {
      const key = group1;
      const value = group2.trim();

      if (!seen.has(key)) {
        seen.add(key);
        shared.push(value);
      }

      return '';
    });

    return {
      content: remainingContent,
      shared: shared.join('\n\n')
    };
  }

  const { shared: sharedTypes, content: prototypesTypes } = parseSharedTypes(
    [collectionsTypes, areasTypes].join('\n')
  );

  const content = [
    ...(IS_RIME_REPO ? ['// eslint-disable-next-line no-restricted-imports'] : []),
    `import '${PACKAGE_NAME}';`,
    `import type { Session } from 'better-auth';`,
    ...(IS_RIME_REPO ? ['// eslint-disable-next-line no-restricted-imports'] : []),
    typeImports,
    '',
    `declare global {`,
    sharedTypes,
    prototypesTypes,
    `}`,
    templateLocals(rimeConfigServerPath),
    templateRegister(config)
  ].join('\n');

  return content;
}

/**
 * Writes the generated types to the app.generated.d.ts file
 * @param content The string containing all type definitions
 */
function write(key: string, content: string, filePath: string) {
  const cachedTypes = cache.get(key);

  if (cachedTypes && cachedTypes === content) {
    return;
  } else {
    cache.set(key, content);
  }

  const [error] = trycatchSync(() => fs.writeFileSync(filePath, content));
  if (error) {
    logger.error(error);
  }
}

/**
 * Generates and writes TypeScript type definitions based on the built configuration
 * @param config The built configuration containing collections, areas, and fields
 */
async function generateTypes<T extends Config>(config: T) {
  const mainTypes = await generateTypesString(config);
  const declarations = templateDeclareVirtualModule();

  const appGeneratedPath = path.resolve(process.cwd(), 'src', 'app.generated.d.ts');
  const virtualModuleGeneratedPath = path.resolve(process.cwd(), 'src', 'rime.generated.d.ts');

  write('app.generated', mainTypes, appGeneratedPath);
  write('rime.generated', declarations, virtualModuleGeneratedPath);
}

export default generateTypes;
