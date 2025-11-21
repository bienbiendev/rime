import { isUploadConfig } from '$lib/core/collections/upload/util/config.js';
import type {
	BuiltArea,
	BuiltCollection,
	Config,
	ImageSizesConfig
} from '$lib/core/config/types.js';
import { PACKAGE_NAME } from '$lib/core/constant.server.js';
import cache from '$lib/core/dev/cache/index.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { logger } from '$lib/core/logger/index.server.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { getFieldPrivateModule } from '$lib/fields/index.server.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import type { Field } from '$lib/fields/types.js';
import { trycatchSync } from '$lib/util/function.js';
import { capitalize, toPascalCase } from '$lib/util/string.js';
import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../../constants.js';

const IS_PACKAGE_DEV = process.env.IS_PACKAGE_DEV === 'true';

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
const makeDocTypeName = (slug: string): string => `${capitalize(slug)}Doc`;

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
 * Generates a type for a block with the given slug and content
 * @example
 * makeBlockType('hero', 'title: string')
 * // returns
 * export type BlockHero {
 *   id: string,
 *   type: 'hero',
 *   title: string
 * }
 */
const makeBlockType = (slug: string, content: string): string => `
export type Block${toPascalCase(slug)} = {
  id: string
  type: '${slug}'
  ${content}
}`;

/**
 * Generates a type for a treeBlock with the given slug and content
 * @example
 * makeTreeBlockType('TreeNav', 'title: string')
 * // returns
 * export type TreeNav {
 *   id: string,
 *   title: string
 *   _children: TreeNav[]
 * }
 */
const makeTreeBlockType = (name: string, content: string): string => `
export type ${name} = {
  id: string;
  ${content};
	_children: ${name}[]
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
		...(IS_PACKAGE_DEV ? ['\t// eslint-disable-next-line no-restricted-imports'] : []),
		`\texport * from '${PACKAGE_NAME}/config/server';`,
		`}`,
		`declare module '$rime/schema' {`,
		`\texport * from '$lib/+rime.generated/schema.server.js';`,
		`}`
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
	const blocksTypes: string[] = [];
	const treeBlocksTypes: string[] = [];
	const registeredBlocks: string[] = [];
	const registeredTreeBlocks: string[] = [];
	let imports = new Set<string>(['BaseDoc', 'Navigation', 'User']);

	const addImport = (string: string) => {
		imports = new Set([...imports, string]);
	};

	/**
	 * Generates fields type definitions string based on a list of field
	 * @returns An array of string containing fields type definitions
	 */
	const buildFieldsTypes = async (fields: FieldBuilder<Field>[]): Promise<string[]> => {
		const strFields: string[] = [];

		for (const field of fields) {
			if (field instanceof FormFieldBuilder || field instanceof TabsBuilder) {
				const fieldServerMethods = await getFieldPrivateModule(field);
				if (fieldServerMethods) {
					const result = await Promise.resolve(fieldServerMethods.toType(field));
					strFields.push(result);
				}
			}
		}
		return strFields;
	};

	const buildblocksTypes = async (fields: FieldBuilder<Field>[]) => {
		for (const field of fields) {
			if (field instanceof BlocksBuilder) {
				{
					for (const block of field.raw.blocks) {
						if (!registeredBlocks.includes(block.raw.name)) {
							const templates = await buildFieldsTypes(
								block.raw.fields
									.filter((field) => field instanceof FormFieldBuilder)
									.filter((field) => field.name !== 'type')
							);
							blocksTypes.push(makeBlockType(block.raw.name, templates.join('\n\t')));
							registeredBlocks.push(block.raw.name);
							buildblocksTypes(block.raw.fields);
						}
					}
				}
			} else if (field instanceof TabsBuilder) {
				for (const tab of field.raw.tabs) {
					await buildblocksTypes(tab.raw.fields);
				}
			} else if (field instanceof GroupFieldBuilder) {
				await buildblocksTypes(field.raw.fields);
			} else if (field instanceof TreeBuilder) {
				await buildblocksTypes(field.raw.fields);
			}
		}
	};

	const buildTreeBlockTypes = async (fields: FieldBuilder<Field>[]) => {
		for (const field of fields) {
			if (field instanceof BlocksBuilder) {
				for (const block of field.raw.blocks) {
					await buildTreeBlockTypes(block.raw.fields);
				}
			} else if (field instanceof TabsBuilder) {
				for (const tab of field.raw.tabs) {
					await buildTreeBlockTypes(tab.raw.fields);
				}
			} else if (field instanceof GroupFieldBuilder) {
				await buildTreeBlockTypes(field.raw.fields);
			} else if (field instanceof TreeBuilder) {
				const treeBlockTypeName = `Tree${toPascalCase(field.name)}`;
				if (!registeredTreeBlocks.includes(treeBlockTypeName)) {
					const treeFieldsTypes = await buildFieldsTypes(
						field.raw.fields.filter((field) => field instanceof FormFieldBuilder)
					);
					const treeBlockType = makeTreeBlockType(treeBlockTypeName, treeFieldsTypes.join('\n'));
					treeBlocksTypes.push(treeBlockType);
					registeredTreeBlocks.push(treeBlockTypeName);
				}
			}
		}
	};

	const processCollection = async (collection: BuiltCollection) => {
		let fields = collection.fields;
		if (isUploadConfig(collection) && collection.upload.imageSizes?.length) {
			fields = collection.fields
				.filter((f) => f instanceof FormFieldBuilder)
				.filter(
					(field) => !collection.upload.imageSizes!.some((size) => size.name === field.raw.name)
				);
		}
		const fieldsTypesList = await buildFieldsTypes(fields);
		if (collection.versions) {
			fieldsTypesList.push('versionId: string');
		}
		let fieldsContent = fieldsTypesList.join('\n\t');
		await buildTreeBlockTypes(fields);
		await buildblocksTypes(fields);
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
		await buildTreeBlockTypes(area.fields);
		await buildblocksTypes(area.fields);
		return templateDocType(area.slug, fieldsTypesList.join('\n\t'));
	};

	const collectionsTypes = (await Promise.all(collections.map(processCollection))).join('\n');
	const areasTypes = (await Promise.all(areas.map(processArea))).join('\n');
	const hasBlocks = !!registeredBlocks.length;
	const blocksTypeNames = `export type BlockTypes = ${registeredBlocks.map((name) => `'${name}'`).join('|')}\n`;
	const anyBlock = `export type AnyBlock = ${registeredBlocks.map((name) => `Block${toPascalCase(name)}`).join('|')}\n`;
	const typeImports = `import type { ${Array.from(imports).join(', ')} } from '${PACKAGE_NAME}/types'`;

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
			/** Singleton providing access to auth, config and local-api */
      rime: ReturnType<
				Awaited<
					typeof import('./lib/${OUTPUT_DIR}/rime.config.server.ts').default
				>['createRimeContext']
			>;
      /** Flag enabled by the core plugin rime.cache when the API cache is ON */
      cacheEnabled: boolean;
      /** Available in panel, routes for sidebar */
      routes: Navigation;
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

	const content = [
		...(IS_PACKAGE_DEV ? ['// eslint-disable-next-line no-restricted-imports'] : []),
		`import '${PACKAGE_NAME}';`,
		`import type { Session } from 'better-auth';`,
		...(IS_PACKAGE_DEV ? ['// eslint-disable-next-line no-restricted-imports'] : []),
		typeImports,
		'',
		relationValueType,
		`declare global {`,
		collectionsTypes,
		areasTypes,
		treeBlocksTypes.join('\n'),
		blocksTypes.join('\n'),
		hasBlocks ? blocksTypeNames : '',
		hasBlocks ? anyBlock : '',
		`}`,
		locals,
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
	const declarations = [templateDeclareVirtualModule()].join('\n');

	const appGeneratedPath = path.resolve(process.cwd(), 'src', 'app.generated.d.ts');
	const virtualModuleGeneratedPath = path.resolve(process.cwd(), 'src', 'rime.generated.d.ts');

	write('app.generated', mainTypes, appGeneratedPath);
	write('rime.generated', declarations, virtualModuleGeneratedPath);
}

export default generateTypes;
