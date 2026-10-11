import { UPLOADS } from '#lib/core/prototype/collection/upload/constant.js';
import {
  filesOwner,
  mediasFolder
} from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import type { WithUpload } from '#lib/core/prototype/collection/upload/util/config.js';

/**
 * Puts `url` and `sizes` on an upload document — the URL of its file and of each generated image
 * size, keyed by its name, in the collection's folder:
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
      if (doc[size.name]) {
        // Handle multiple formats
        const formats = doc[size.name].split('|') as string[];
        // Multiple formats
        if (formats.length > 1) {
          formats.forEach((format) => {
            const extension = format.split('.').pop()!;
            doc.sizes[`${size.name}_${extension}`] = mediaUrl(format);
          });
          // Single format
        } else {
          doc.sizes[size.name] = mediaUrl(formats[0]);
        }
        delete doc[size.name];
      } else {
        // Default case: use original file as string
        doc.sizes[size.name] = mediaUrl(doc.filename);
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
