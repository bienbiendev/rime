import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { Relation } from '$lib/fields/relation/relation.js';
import type { RelationRef } from '$lib/fields/types.js';
import {
  type BuiltCollection,
  type CollectionSlug,
  type RelationValue,
  type UploadDoc
} from '$lib/types.js';
import { getValueAtPath } from '$lib/util/object.js';

/**
 * Puts `_thumbnail` on the document — the URL the panel shows for it in a list.
 *
 * Runs after `populateSizes`, so it can take the thumbnail size an upload collection generated
 * rather than the original file.
 */
export const setDocumentThumbnail = Hooks.beforeRead(async (args) => {
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
    const [first] = getValueAtPath<RelationValue<UploadDoc>>(config.asThumbnail, doc) ?? [];
    if (!first) return args;

    const readMedia = (ref: RelationRef) =>
      args.event.locals.rime
        .collection(ref.relationTo as CollectionSlug)
        .findById({ id: ref.documentId }) as Promise<UploadDoc>;

    const media = Relation.isRef(first) ? await readMedia(first) : first;
    doc = { _thumbnail: media._thumbnail, ...doc };
  }

  return { ...args, doc };
});
