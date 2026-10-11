import type { JSONContent } from '@tiptap/core';

/**
 * The rich-text nodes that name a document of a collection, by kind: the prefix of their type,
 * followed by the collection's slug, what a node stores, and what a read fills from its document.
 *
 * ```
 * rich-text-upload-medias   stores { id, legend }   reads url, sizes, title, mimeType, filename
 * rich-text-resource-pages  stores { id }           reads title, _type, _thumbnail
 * ```
 */
export const REFERENCE_NODES = {
  upload: {
    prefix: 'rich-text-upload-',
    stored: ['id', 'legend'],
    read: ['url', 'sizes', 'title', 'mimeType', 'filename']
  },
  resource: {
    prefix: 'rich-text-resource-',
    stored: ['id'],
    read: ['title', '_type', '_thumbnail']
  }
} as const;

export type ReferenceKind = keyof typeof REFERENCE_NODES;

/** A node naming a document, with its kind and its collection's slug. */
export type Reference = { node: JSONContent; kind: ReferenceKind; slug: string };

/**
 * The kind and collection of a node naming a document, `undefined` for any other node.
 *
 * ```ts
 * referenceOf({ type: 'rich-text-resource-pages' }); // { kind: 'resource', slug: 'pages' }
 * referenceOf({ type: 'paragraph' });                // undefined
 * ```
 */
export const referenceOf = (node: JSONContent) => {
  for (const kind of Object.keys(REFERENCE_NODES) as ReferenceKind[]) {
    const { prefix } = REFERENCE_NODES[kind];
    if (node.type?.startsWith(prefix)) return { kind, slug: node.type.slice(prefix.length) };
  }
  return undefined;
};

/** Every node of a rich text naming a document, at any depth. */
export const referenceNodes = (content: JSONContent): Reference[] => {
  const reference = referenceOf(content);
  return [
    ...(reference ? [{ node: content, ...reference }] : []),
    ...(content.content ?? []).flatMap(referenceNodes)
  ];
};

/** A copy of a rich text, the `attrs` of each node naming a document replaced by `attrs(…)`. */
export const mapReferenceNodes = (
  content: JSONContent,
  attrs: (reference: Reference) => JSONContent['attrs']
): JSONContent => {
  const reference = referenceOf(content);
  return {
    ...content,
    ...(reference && { attrs: attrs({ node: content, ...reference }) }),
    ...(Array.isArray(content.content) && {
      content: content.content.map((child) => mapReferenceNodes(child, attrs))
    })
  };
};

/**
 * A rich text as it is stored: a node naming a document keeps what its kind stores, and a read
 * fills the rest from the document. A node with no `id` keeps what it holds.
 *
 * ```ts
 * storedReferences({ type: 'doc', content: [{ type: 'rich-text-upload-medias', attrs: { id: 'm1', url: '/medias/a.jpg', legend: 'Sea' } }] });
 * // { type: 'doc', content: [{ type: 'rich-text-upload-medias', attrs: { id: 'm1', legend: 'Sea' } }] }
 * ```
 */
export const storedReferences = (content: JSONContent) =>
  mapReferenceNodes(content, ({ node: { attrs }, kind }) =>
    attrs?.id
      ? Object.fromEntries(REFERENCE_NODES[kind].stored.map((key) => [key, attrs[key] ?? null]))
      : attrs
  );
