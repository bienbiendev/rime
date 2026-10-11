import type { BuiltCollection } from '#lib/core/config/types.js';
import { mediasFolder } from '#lib/core/prototype/collection/upload/disk/medias.server.js';

/** One lowercase segment: `invoices`, `press-kit`, `2026`. */
const FOLDER = /^[a-z0-9][a-z0-9-]*$/;

/**
 * What the upload collections of a config have to look like: each folder one lowercase segment,
 * and no two collections in the same folder. A versions collection shares its document's folder
 * and is not checked. `config/validate.server.ts` asks it of the collections.
 *
 * ```ts
 * validateUploads([{ slug: 'docs', upload: { folder: 'Docs/2026' } }]); // ['Upload folder "Docs/2026" …']
 * ```
 */
export const validateUploads = (collections: BuiltCollection[]): string[] => {
  const errors: string[] = [];
  const bySlug = new Map<string, string>();

  for (const config of collections) {
    if (!config.upload || config._shadowOf) continue;
    const folder = mediasFolder(config);

    if (!FOLDER.test(folder)) {
      errors.push(
        `Upload folder "${folder}" of ${config.slug} must be one lowercase segment: letters, digits and "-"`
      );
    }
    const other = bySlug.get(folder);
    if (other) {
      errors.push(`Upload folder "${folder}" is used by both ${other} and ${config.slug}`);
    }
    bySlug.set(folder, config.slug);
  }

  return errors;
};
