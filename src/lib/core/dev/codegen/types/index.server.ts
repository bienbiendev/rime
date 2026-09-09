import { IS_RIME_REPO, PACKAGE_NAME } from '$lib/core/constants.server.js';
import cache from '$lib/core/dev/cache.server.js';
import type { BuiltArea, BuiltCollection, Config } from '$lib/core/config/types.js';
import type { FeatureDefinition } from '$lib/core/features/define.js';
import { docTypeWithFeatures } from '$lib/core/features/registry.js';
import { area, collection } from '$lib/core/prototype/index.js';

import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
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
 * Generates the complete TypeScript type definitions string based on the built configuration
 * @returns A string containing all type definitions
 */
export async function generateTypesString<T extends Config>(config: T) {
  logger.info('Types generation...');
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

  /**
   * One prototype's document type.
   *
   * Was two functions, `processCollection` and `processArea`, differing only in the feature
   * branches the first one carried: `isUploadConfig(collection)` three times and
   * `if (collection.versions)` once. Both are `docType` contributions now, so what is left is the
   * same for either kind — which is why there is one function.
   */
  const processPrototype = async (
    features: FeatureDefinition[],
    config: BuiltArea | BuiltCollection
  ) => {
    const contribution = docTypeWithFeatures(features, config);

    const fieldsTypesList = await buildFieldsTypes(config.fields.filter(contribution.fields));
    contribution.extends.forEach(addImport);

    return templateDocType(
      config.slug,
      [...fieldsTypesList, ...contribution.members].join('\n\t'),
      contribution.extends
    );
  };

  const generated = <T extends { _generateTypes?: false }>(configs: T[] | undefined) =>
    (configs ?? []).filter((c) => c._generateTypes !== false);

  const collectionsTypes = (
    await Promise.all(
      generated(config.collections).map((c) => processPrototype(collection.features, c))
    )
  ).join('\n');
  const areasTypes = (
    await Promise.all(generated(config.areas).map((a) => processPrototype(area.features, a)))
  ).join('\n');
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
