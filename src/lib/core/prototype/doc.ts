/** Which blank is being shaped — see `shapeBlank` at the foot of this file. */
export type BlankIntent = 'create' | 'seed';

import { blankAuthDocument } from '$rime/modules';
import { isAuth } from '$lib/core/auth/enabled.js';
import { blankVersion } from '$lib/core/versions/blank.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { snapshot } from '$lib/util/state.js';

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
        curr.get.tabs.forEach((tab) => {
          prev[tab.name] = tab.get.fields.reduce(reduceFieldsToBlankDocument, {});
        });
      } else if (['blocks', 'relation', 'tree'].includes(curr.type)) {
        prev[curr.name] = [];
      } else if (curr instanceof GroupFieldBuilder) {
        prev[curr.name] = curr.get.fields.reduce(reduceFieldsToBlankDocument, {});
      } else if (curr instanceof FormFieldBuilder) {
        // Presentational fields (separator, bare component()) are plain
        // FieldBuilder, never FormFieldBuilder, and get skipped here rather
        // than assigned `prev['']` (they never got a real name) — that used
        // to corrupt the parent object into looking array-like once
        // flattened/unflattened.
        const defaultValue = curr.use.defaultValue({ event });
        prev[curr.name] = defaultValue !== undefined ? defaultValue : null;
      }
    } catch (err) {
      console.error(curr);
      throw err;
    }
    return prev;
  }

  const fields: GenericDoc['fields'] = config.fields.reduce(reduceFieldsToBlankDocument, {});

  /**
   * The fields, plus what every document has regardless of kind. Nothing feature-shaped: a
   * feature adds to this through `FeatureDefinition.blank`, which the local API folds — see
   * `prototype/api.server.ts`.
   *
   * An `isUploadConfig(config) && 'imageSizes' in config` branch used to seed `sizes: {}` here.
   * It never once ran: `imageSizes` is a member of `UploadConfig`, so it lives at
   * `config.upload.imageSizes` and never at `config.imageSizes` — every other reader in the repo
   * uses the former. Removed rather than moved to `upload.blank`, because reviving a branch that
   * has never executed is a behaviour change, not a relocation.
   */
  return {
    ...fields,
    _type: config.slug,
    _prototype: config.type
  } as T;
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
 * A blank document, after everything that shapes one has.
 *
 * Two steps, and they are the whole list: `auth` strips its private members from what the local
 * API hands out, `versions` publishes the row `boot` writes for a singleton that has none yet.
 * `intent` says which blank this is.
 *
 * Was `blankWithFeatures`, a fold over every feature calling `FeatureDefinition.blank` on the two
 * that had one — and `blankAuthDocument` comes through `$rime/modules`, so it is `undefined` on a
 * client build, which is where the guard comes from.
 */
export const shapeBlank = (doc: Dic, config: Dic, intent: BlankIntent): Dic => {
  const withoutPrivateFields = isAuth(config) && blankAuthDocument ? blankAuthDocument(doc) : doc;
  return blankVersion(withoutPrivateFields, config, intent);
};
