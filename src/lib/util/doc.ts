import { isUploadConfig } from '$lib/core/collections/upload/util/config.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { getValueAtPath } from './object.js';
import { snapshot } from './state.js';

/**
 * Creates a blank document based on a collection or area configuration.
 * Initializes all fields with appropriate default values based on their type.
 *
 * @returns A new blank document with default values for all fields
 *
 * @example
 * // Create a blank document for the 'pages' collection
 * const blankPage = createBlankDocument(config.getCollection('pages'));
 */
export const createBlankDocument = <
	C extends BuiltCollection | BuiltArea,
	T extends GenericDoc = GenericDoc
>(
	config: C,
	event?: RequestEvent
): T => {
	/**
	 * Recursively processes field definitions to create a blank document structure.
	 * Handles special field types like tabs, blocks, relations, and nested fields.
	 */
	function reduceFieldsToBlankDocument(prev: Dic, curr: FieldBuilder<any>) {
		try {
			if (curr instanceof TabsBuilder) {
				curr.raw.tabs.forEach((tab) => {
					prev[tab.name] = tab.raw.fields.reduce(reduceFieldsToBlankDocument, {});
				});
			} else if (['blocks', 'relation', 'tree'].includes(curr.type)) {
				prev[curr.raw.name] = [];
			} else if ('fields' in curr.raw) {
				prev[curr.raw.name] = curr.raw.fields.reduce(reduceFieldsToBlankDocument, {});
			} else {
				if (curr.raw.defaultValue !== undefined) {
					if (typeof curr.raw.defaultValue === 'function') {
						prev[curr.raw.name] = curr.raw.defaultValue({ event });
					} else {
						prev[curr.raw.name] = curr.raw.defaultValue;
					}
				} else {
					prev[curr.raw.name] = null;
				}
			}
		} catch (err) {
			console.error(curr);
			throw err;
		}
		return prev;
	}

	const fields: GenericDoc['fields'] = config.fields.reduce(reduceFieldsToBlankDocument, {});

	const empty = {
		...fields,
		_type: config.slug,
		_prototype: config.type
	};

	if (
		config.type === 'collection' &&
		isUploadConfig(config) &&
		'imageSizes' in config &&
		config.imageSizes
	) {
		empty.sizes = {};
	}

	return empty as T;
};

/**
 * Converts a flat array of documents into a nested tree structure based on parent-child relationships.
 * Documents are organized hierarchically with each document containing its children in the _children property.
 *
 * @param documents - Array of documents with parent properties indicating their relationships
 * @returns A nested tree structure where each document contains its children
 *
 * @example
 * // Convert a flat list of pages into a hierarchical structure
 * const pageTree = toNestedStructure(pagesList);
 * // Result: [{ id: '1', _children: [{ id: '2', _children: [] }] }]
 */
/**
 * Converts a flat array of documents into a nested tree structure
 * based on _parent and _position fields
 */
export const toNestedStructure = (documents: GenericDoc[]) => {
	const incomingDocs = snapshot(documents);

	// Create a map for quick document lookup by ID
	const docById = new Map<string, GenericDoc>();
	incomingDocs.forEach((doc) => docById.set(doc.id, doc));

	// Track processed documents to prevent infinite recursion
	const processed = new Set<string>();

	// Process documents recursively
	const processDocument = (doc: GenericDoc): GenericDoc => {
		if (!doc || processed.has(doc.id)) {
			return doc;
		}

		processed.add(doc.id);
		const result = { ...doc };

		// Process children first (depth-first)
		if (Array.isArray(result._children)) {
			result._children = result._children
				.map((id: string) => {
					const childDoc = docById.get(id);
					return childDoc ? processDocument(childDoc) : null;
				})
				.filter(Boolean);
		}

		// Only set the parent ID, don't process it recursively
		if (result._parent && typeof result._parent === 'string') {
			result._parent = docById.get(result._parent)?.id || null;
		}

		return result;
	};

	const output = incomingDocs
		.filter((doc) => !doc._parent)
		.map(processDocument)
		.sort((a, b) => (a._position || 0) - (b._position || 0));

	// Filter to get root documents and process them
	return output;
};

/**
 * Remove block type in path
 * @example
 * normalizePath('foo.bar.0:content.baz')
 *
 * // return foo.bar.0.baz
 */
export const normalizeFieldPath = (path: string) => {
	const regExpBlockType = /:[a-zA-Z0-9]+/g;
	return path.replace(regExpBlockType, '');
};

/**
 * Ensure path exists, meaning the path hold anything else than undefined.
 *
 * @example
 * const obj = { foo: { baz: null }, bar: 1 };
 * ensurePathExists('foo.bar', obj); // false
 * ensurePathExists('foo.baz', obj); // true
 * ensurePathExists('bar', obj); // true
 */
export const ensurePathExists = (path: string, obj: Dic): boolean => {
	const value = getValueAtPath(path, obj);
	return value !== undefined;
};
