import { UPLOADS } from '#lib/core/prototype/collection/upload/constant.js';
import {
  filesOwner,
  mediasFolder
} from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import type { WithUpload } from '#lib/core/prototype/collection/upload/util/config.js';

/**
 * Runs on every read of an upload document: puts the URL of each image size in `sizes` (one key
 * per format, `hero_webp`, when a size has several), `_thumbnail` (the `thumbnail` size or its
 * first format, else the file) and `url`, and removes the raw size columns. The URLs point into
 * the collection's folder:
 *
 * ```
 * medias           /uploads/medias/photo.jpg
 * private-medias   /uploads/private-medias/photo-thumbnail-400.jpg
 * ```
 */
export const populateSizes = Hooks.beforeRead(async function populateSizes(args) {
  const config = args.config as WithUpload<BuiltCollection>;
  const doc = args.doc;

  const folder = mediasFolder(filesOwner(args.event.locals.rime.config, config));
  const mediaUrl = (filename: string) => `${UPLOADS.URL}/${folder}/${filename}`;

  if ('imageSizes' in config.upload && config.upload.imageSizes && doc.filename) {
    doc.sizes = {};
    for (const size of config.upload.imageSizes) {
      const stored: string | null = doc[size.name];
      delete doc[size.name];

      if (!stored) {
        // A size with no file of its own: the original
        doc.sizes[size.name] = mediaUrl(doc.filename);
        continue;
      }
      const formats = stored.split('|');
      if (formats.length > 1) {
        formats.forEach((format) => {
          const extension = format.split('.').pop()!;
          doc.sizes[`${size.name}_${extension}`] = mediaUrl(format);
        });
      } else {
        doc.sizes[size.name] = mediaUrl(formats[0]);
      }
    }

    // Add the _thumbnail prop
    if ('thumbnail' in doc.sizes) {
      doc._thumbnail = doc.sizes.thumbnail;
    } else {
      const thumbnailKey = Object.keys(doc.sizes).find((sizeName) =>
        sizeName.startsWith('thumbnail')
      );
      if (thumbnailKey) {
        doc._thumbnail = doc.sizes[thumbnailKey];
      } else {
        doc._thumbnail = mediaUrl(doc.filename);
      }
    }
  }

  doc.url = doc.filename ? mediaUrl(doc.filename) : null;

  return { ...args, doc };
});
