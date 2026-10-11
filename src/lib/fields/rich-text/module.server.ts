import type { BuiltCollection } from '#lib/core/config/types.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';
import type { FieldHook, FieldHookDuplicate } from '#lib/fields/types.js';
import { trycatch } from '#lib/util/function.js';
import type { Dic } from '#lib/util/types.js';
import type { RichTextField } from './index.js';
import { isJSONContent, RichText } from './json.js';
import {
  mapReferenceNodes,
  REFERENCE_NODES,
  referenceNodes,
  type ReferenceKind
} from './reference-nodes.js';

/**
 * The fields a read of each kind selects: what its attributes come from, and nothing else. The
 * document read has none of its own rich text read, so two documents naming each other do not
 * read each other in turn.
 */
const SELECT: Record<ReferenceKind, (config: BuiltCollection) => string[]> = {
  upload: (config) => [
    'title',
    config.asTitle,
    'filename',
    'mimeType',
    ...(config.upload?.imageSizes ?? []).map((size) => size.name)
  ],
  resource: (config) => [
    'title',
    config.asTitle,
    '_thumbnail',
    ...(config.asThumbnail ? [config.asThumbnail] : [])
  ]
};

/**
 * Fills each node of a rich text naming a document, at any depth, from that document as the
 * read's caller sees it now. One read per collection, whatever the kinds naming it. A document the
 * caller may not read, or a missing one, leaves every attribute it fills `null`; a node with no
 * `id` keeps what it holds.
 *
 * ```ts
 * // { type: 'rich-text-upload-medias', attrs: { id: 'm1', legend: 'Sea' } }
 * //   -> attrs: { id: 'm1', legend: 'Sea', url: '/uploads/medias/sea.jpg', sizes: {…},
 * //               title: 'sea.jpg', mimeType: 'image/jpeg', filename: 'sea.jpg' }
 * // { type: 'rich-text-resource-pages', attrs: { id: 'p1' } }
 * //   -> attrs: { id: 'p1', title: 'About', _type: 'pages', _thumbnail: '/uploads/medias/a.jpg' }
 * ```
 */
export const populateReferences: FieldHook<RichTextField> = async (value, { event, operation }) => {
  if (!isJSONContent(value)) return value;
  // No node naming a document: nothing to read
  const references = referenceNodes(value).filter(({ node }) => node.attrs?.id);
  if (!references.length) return value;
  const { rime } = event.locals;

  // The ids each collection's nodes name, and the fields their kinds read
  const reads = new Map<CollectionSlug, { ids: Set<string>; select: Set<string> }>();
  for (const { node, kind, slug } of references) {
    if (!rime.config.isCollection(slug)) continue;
    const read = reads.get(slug) ?? { ids: new Set(), select: new Set() };
    read.ids.add(node.attrs!.id);
    SELECT[kind](rime.config.getCollection(slug)).forEach((path) => read.select.add(path));
    reads.set(slug, read);
  }

  // Read as the read runs: a document the caller may not read is left out
  const documents = new Map<string, Dic>();
  for (const [slug, { ids, select }] of reads) {
    const [, docs] = await trycatch(() =>
      rime
        .collection(slug)
        .system(!!operation.isSystemOperation)
        .findByIds({ ids: [...ids], select: [...select] })
    );
    for (const doc of docs ?? []) {
      // `_type` is the collection: a read with a `select` leaves it out
      documents.set(`${slug}:${doc.id}`, { ...doc, _type: slug });
    }
  }

  return mapReferenceNodes(value, ({ node: { attrs }, kind, slug }) => {
    if (!attrs?.id) return attrs;
    const doc = documents.get(`${slug}:${attrs.id}`);
    const read = REFERENCE_NODES[kind].read.map((key) => [key, doc?.[key] ?? null]);
    return { ...attrs, ...Object.fromEntries(read) };
  });
};

/**
 * A rich-text title on a copy gets ` (copy)` after its last text, so its nodes and marks stay. A
 * plain-string title gets it as text, and a title with no text stays as it is.
 *
 * ```ts
 * // richText('heading').isTitle()
 * duplicateRichText({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Sale' }] }] }, context);
 * // { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Sale' }, { type: 'text', text: ' (copy)' }] }] }
 * ```
 */
export const duplicateRichText: FieldHookDuplicate<RichTextField> = (value, { config }) => {
  if (!config.isTitle || !RichText.toText(value).trim()) return value;
  return isJSONContent(value) ? RichText.appendText(value, ' (copy)') : `${value} (copy)`;
};
