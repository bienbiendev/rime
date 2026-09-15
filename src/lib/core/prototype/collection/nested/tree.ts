import type { GenericDoc } from '$lib/core/prototype/types.js';
import { snapshot } from '$lib/util/state.js';

/**
 * The flat rows of a nested collection as a tree, each document holding its own children.
 *
 * Roots are the documents with no `_parent`, ordered by `_position`; a document already placed is
 * never placed twice, so a cycle in the rows stops rather than recurses.
 *
 * ```ts
 * toNestedStructure(pages); // [{ id: '1', _children: [{ id: '2', _children: [] }] }]
 * ```
 */
export const toNestedStructure = (documents: GenericDoc[]) => {
  const incomingDocs = snapshot(documents);

  const docById = new Map<string, GenericDoc>();
  incomingDocs.forEach((doc) => docById.set(doc.id, doc));

  const processed = new Set<string>();

  const processDocument = (doc: GenericDoc): GenericDoc => {
    if (!doc || processed.has(doc.id)) {
      return doc;
    }

    processed.add(doc.id);
    const result = { ...doc };

    // Children first, depth-first.
    if (Array.isArray(result._children)) {
      result._children = result._children
        .map((id: string) => {
          const childDoc = docById.get(id);
          return childDoc ? processDocument(childDoc) : null;
        })
        .filter(Boolean);
    }

    // The parent stays an id — only children are expanded.
    if (result._parent && typeof result._parent === 'string') {
      result._parent = docById.get(result._parent)?.id || null;
    }

    return result;
  };

  return incomingDocs
    .filter((doc) => !doc._parent)
    .map(processDocument)
    .sort((a, b) => (a._position || 0) - (b._position || 0));
};
