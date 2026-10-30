import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { forList } from '#lib/core/pipeline/run.server.js';
import type { RawDoc } from '#lib/core/prototype/types.js';
import { Relation } from '#lib/fields/relation/relation.js';
import {
  type BuiltCollection,
  type CollectionSlug,
  type RelationValue,
  type UploadDoc
} from '#lib/types.js';
import { getValueAtPath } from '#lib/util/object.js';

/**
 * Puts `_thumbnail` on the document — the URL the panel shows for it in a list.
 *
 * Runs after `populateSizes`, so it can take the thumbnail size an upload collection generated
 * rather than the original file.
 */
export const setDocumentThumbnail = Hooks.beforeRead(async function setDocumentThumbnail(args) {
  const config = args.config;
  let doc = args.doc;

  const hasThumbnail = (
    c: typeof args.config
  ): c is BuiltCollection & {
    asThumbnail: string;
  } => {
    return c.type === 'collection' && !!c.asThumbnail;
  };

  const paramSelect = args.context.params.select;
  const hasSelect = Array.isArray(paramSelect) && paramSelect.length;
  const shouldSetThumbnail =
    hasThumbnail(config) &&
    !doc._thumbnail &&
    (!hasSelect || (hasSelect && paramSelect.includes('_thumbnail')));

  if (shouldSetThumbnail) {
    // At depth 0 the relation holds a ref to the media; at depth 1 or more, the media itself.
    const firstOf = (listed: RawDoc) =>
      getValueAtPath<RelationValue<UploadDoc>>(config.asThumbnail, listed)?.[0];
    const first = firstOf(doc);
    if (!first) return args;

    // The media every listed document names, in one read as the read runs. One relation field
    // points at one collection, so the first ref names it. A media the reader may not read is
    // left out: that document gets no thumbnail, and is still read.
    const readMedia = async (docs: RawDoc[]) => {
      const refs = docs.map(firstOf).filter(Relation.isRef);
      if (!refs.length) return new Map<string, UploadDoc>();
      const media = await args.event.locals.rime
        .collection(refs[0].relationTo as CollectionSlug)
        .system(!!args.context.isSystemOperation)
        .findByIds({ ids: [...new Set(refs.map((ref) => ref.documentId))] });
      return new Map((media as UploadDoc[]).map((item) => [item.id, item]));
    };

    const media = Relation.isRef(first)
      ? (await forList(args, 'thumbnail.media', readMedia)).get(first.documentId)
      : first;
    if (media) doc = { _thumbnail: media._thumbnail, ...doc };
  }

  return { ...args, doc };
});
