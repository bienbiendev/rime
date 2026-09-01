import { PACKAGE_NAME } from '$lib/core/constants.server.js';
import cache from '$lib/core/dev/cache.server.js';
import type {
  BuiltArea,
  BuiltCollection,
  Config,
  ImageSizesConfig
} from '$lib/core/factory/config/types.js';
import { isUploadConfig } from '$lib/core/features/upload/util/config.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { logger } from '$lib/core/logger.server.js';
import type { Field } from '$lib/fields/types.js';
import { trycatchSync } from '$lib/util/function.js';
import { capitalize } from '$lib/util/string.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENERATED_DIR,
  isInstalledDependency,
  relativeImportSpecifier
} from '../../constants.server.js';

const IS_RIME_REPO = !isInstalledDependency(import.meta.url);

// Relation  type
const relationValueType = `
export type RelationValue<T> =
	| T[] // When depth > 0, fully populated docs
	| { id?: string; relationTo: string; documentId: string }[] // When depth = 0, relation objects
	| string[]
	| string; // When sending data to update`;

/**
 * Generate document's type name
 * @example
 * makeDocTypeName('pages')
 * // return PagesDoc
 */
const makeDocTypeName = (slug: string): string => `${capitalize(slug.replace('$', ''))}Doc`;

/**
 * Generate the document's type definition
 * @returns the full document type
 */
const templateDocType = (slug: string, content: string, upload?: boolean): string => `
export type ${makeDocTypeName(slug)} = BaseDoc & ${upload ? 'UploadDoc & ' : ''} {
  ${content};
	[x: string]: unknown;
}`;

/**
 * Generates the module declaration for registering document types
 * @returns A string containing the module declaration for type registration
 */
const templateRegister = <T extends Config>(config: T): string => {
  const collections = (config.collections || []).filter((c) => c._generateTypes !== false);
  const areas = (config.areas || []).filter((c) => c._generateTypes !== false);
  const registerCollections = collections.length
    ? [
        '\tinterface RegisterCollection {',
        `${collections
          .map((collection) => {
            let collectionRegister = `\t\t'${collection.slug}': ${makeDocTypeName(collection.slug)}`;
            if (collection.versions) {
              collectionRegister += `\n\t\t'${withVersionsSuffix(collection.slug)}': ${makeDocTypeName(collection.slug)}`;
            }
            return collectionRegister;
          })
          .join('\n')};`,
        '\t}'
      ]
    : [];
  const registerAreas = areas.length
    ? [
        '\tinterface RegisterArea {',
        `${areas
          .map((area) => {
            const areaRegister = `\t\t'${area.slug}': ${makeDocTypeName(area.slug)}`;
            return areaRegister;
          })
          .join('\n')};`,
        '\t}'
      ]
    : [];
  return ["declare module 'rimecms' {", ...registerCollections, ...registerAreas, '}'].join('\n');
};

const templateDeclareVirtualModule = () =>
  [
    `declare module '$rime/config' {`,
    ...(IS_RIME_REPO ? ['\t// eslint-disable-next-line no-restricted-imports'] : []),
    `\texport * from '${PACKAGE_NAME}/config/server';`,
    `}`,
    `declare module '$rime/schema' {`,
    `\texport * from '$lib/rime.schema.server.js';`,
    `}`
    // $rime/modules (the bare barrel) is typed by src/rime.modules.generated.d.ts instead —
    // written directly by the Vite plugin's own dev-server watcher (regenerateModulesDeclaration
    // in core/dev/vite.server.ts), not here, since it needs to react to module.(server.)ts
    // files appearing/changing on their own, independent of a config regen.
    //
    // A package's own qualified $rime/modules/<pkg>/<path> references are self-contained —
    // generate-manifest inserts a /// <reference> directly into each rewritten .d.ts file at
    // prepack (see generate-manifest/index.server.ts), so this app never needs to know which
    // installed packages exist or eagerly reference all of them; verified directly (a real tsc
    // run resolves it correctly from a file two levels deep inside node_modules, zero consumer
    // awareness needed).
  ].join('\n');

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

  const locals = `declare global {
  namespace App {
    interface Locals {
			/** Flag only ON when create the first panel user */
			isInit?: boolean;
			/** The better auth session */
      session: Session | undefined;
			/** The rime user document when authenticated */
      user: User | undefined;
			/**
			 * Flag enabled when a create operation is triggered
			 * by a auth/sign-up api call.
			 */
			isAutoSignIn?: boolean;
			/** The full better-auth user */
			betterAuthUser:
			| {
					id: string;
					name: string;
					email: string;
					emailVerified: boolean;
					createdAt: Date;
					updatedAt: Date;
					role?: string | null | undefined;
					banned: boolean | null | undefined;
					banReason?: string | null | undefined;
					banExpires?: Date | null | undefined;
					type: string;
				}
			| undefined;
			/** Singleton providing access to auth, config and the local API */
      rime: ReturnType<
				Awaited<
					typeof import('${rimeConfigServerPath}').default
				>['createRimeContext']
			>;
      /** Flag enabled by the core plugin rime.cache when the API cache is ON */
      cacheEnabled: boolean;
      /** Available in panel, nav routes for sidebar */
      navigation: Navigation;
      /** Dispatch facade backing the fixed /panel/[slug]/... and /api/[slug]/... routes */
      routes: RouteHandlers;
			/**
			 * Current locale if applicable
			 * set following this prioroty :
			 * - locale inside the url from your front-end ex: /en/foo
			 * - locale from searchParams ex : ?locale=en
			 * - locale from cookie
			 * - default locale
			*/
      locale: string | undefined;
    }
  }
}`;

  function parseHeaders(content: string): {
    content: string;
    headers: string;
  } {
    const regex =
      /\/\*\*\s*@dedupe-start\s+([^\r\n*]*?)\s*\*\*([\s\S]*?)\*\*\s*@dedupe-end\s*\*\//g;

    const seen = new Set<string>();
    const headers: string[] = [];

    const remainingContent = content.replace(regex, (_match, group1: string, group2: string) => {
      const key = group1.replace(/\s+/g, '');
      const value = group2.trim();

      if (!seen.has(key)) {
        seen.add(key);
        headers.push(value);
      }

      return '';
    });

    return {
      content: remainingContent,
      headers: headers.join('\n\n')
    };
  }

  const content = [
    ...(IS_RIME_REPO ? ['// eslint-disable-next-line no-restricted-imports'] : []),
    `import '${PACKAGE_NAME}';`,
    `import type { Session } from 'better-auth';`,
    ...(IS_RIME_REPO ? ['// eslint-disable-next-line no-restricted-imports'] : []),
    typeImports,
    '',
    relationValueType,
    `declare global {`,
    collectionsTypes,
    areasTypes,
    `}`,
    locals,
    templateRegister(config)
  ].join('\n');

  const { headers, content: stripedContent } = parseHeaders(content);
  return [stripedContent, headers].join('\n');
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
