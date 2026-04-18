import { isRelationResolved } from '$lib/fields/relation/index.js';
import {
  type BuiltCollection,
  type CollectionSlug,
  type GenericDoc,
  type RelationValue,
  type UploadDoc
} from '$lib/types.js';
import { getValueAtPath } from '$lib/util/object.js';
import { Hooks } from '../index.server.js';

export const setDocumentThumbnail = Hooks.beforeRead<'raw'>(async (args) => {
  const config = args.config;
  let doc = args.doc;

  const hasThumbnail = (
    c: typeof args.config
  ): c is BuiltCollection & {
    asThumbnail: string;
  } => {
    return config.type === 'collection' && !!config.asThumbnail;
  };

  const paramSelect = args.context.params.select;
  const hasSelect = Array.isArray(paramSelect) && paramSelect.length;
  const shouldSetThumbnail =
    hasThumbnail(config) &&
    !doc._thumbnail &&
    (!hasSelect || (hasSelect && paramSelect.includes('_thumbnail')));

  if (shouldSetThumbnail) {
    const relationValue = getValueAtPath<RelationValue<UploadDoc>>(config.asThumbnail, doc);
    if (!relationValue) return args;

    const unwraped = Array.isArray(relationValue) ? relationValue[0] : relationValue;
    if (typeof unwraped === 'string') return args;

    const relationResolved = isRelationResolved<GenericDoc>(unwraped)
      ? unwraped
      : await args.event.locals.rime
          .collection(unwraped.relationTo as CollectionSlug)
          .findById({ id: unwraped.documentId });

    doc = {
      _thumbnail: relationResolved._thumbnail,
      ...doc
    };
  }

  return { ...args, doc };
});
