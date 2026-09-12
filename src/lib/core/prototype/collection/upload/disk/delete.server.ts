import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { logger } from '$lib/core/logger.server.js';
import { isFormField } from '$lib/core/fields/util.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { RimeContext } from '$lib/core/rime.server.js';
import { existsSync, unlink, unlinkSync } from 'fs';
import path from 'path';
import type { WithUpload } from '$lib/core/prototype/collection/upload/util/config.js';

/**
 * Whether this collection's **own table** holds `name` — which is the only question this file has
 * about where a filename can be.
 *
 * A config with a versions table keeps only its `$root()` fields on its own table; everything else is the
 * versions's, and the versions table is a registered collection in its own right. `filename` is not a root
 * field (only `_path` is, on upload), so on a versioned upload collection it lives on the versions table
 * and the base table has no such column at all.
 *
 * This replaces a pair of tests that named the versions feature — `!hasVersionsSuffix(slug)` to
 * drop the version tables from the scan, then `versions ? withVersionsSuffix(slug) : slug` to map each
 * base onto one. Same set of slugs, arrived at by asking the schema instead of reading a suffix,
 * and with no feature importing another feature to do it.
 */
const ownsField = <C extends Config>(
  rime: RimeContext<C>,
  config: BuiltCollection,
  name: string
): boolean => {
  const field = config.fields.filter(isFormField).find((one) => one.name === name);
  if (!field) return false;

  return config._versions ? !!field.get.root : true;
};

/**
 * A given filename on disk can be shared by several document rows across unrelated upload
 * collections — saveFile dedupes any byte-identical upload to a single file (see isSameFile).
 *
 * The scan goes table by table, not collection by collection, and that distinction is load-bearing
 * for a collection whose content lives on a versions table: querying the *collection* returns one row per
 * document (the read joins in a single content row), so a filename referenced only by an older
 * revision would be missed and the file deleted out from under it. Querying the versions table directly
 * sees every revision. `ownsField` above is what picks the right table without knowing why there
 * are two.
 *
 * `selfId` must already be in whichever id-space `selfSlug` resolves to — a versions table row's own id,
 * not the base row's (see `contentId` in mergeContentRow).
 *
 * Every configured locale is checked since a localized collection's query can otherwise miss rows
 * in non-default locales, even though `filename` itself is never a localized field.
 */
const isFilenameStillReferenced = async <C extends Config>(args: {
  rime: RimeContext<C>;
  filename: string;
  selfSlug: string;
  selfId: string;
}): Promise<boolean> => {
  const { rime, filename, selfSlug, selfId } = args;

  // Every table a row carrying this filename could be in. `upload` narrows it to collections that
  // store files at all; `ownsField` picks the one table of each that actually has the column.
  const targetSlugs = Object.values(rime.config.collections)
    .filter((c) => c?.upload && ownsField(rime, c, 'filename'))
    .map((c) => c.slug);

  const locales = rime.config.getLocalesCodes();
  const localesToQuery = locales.length ? locales : [undefined];

  for (const slug of targetSlugs) {
    for (const locale of localesToQuery) {
      const docs = await rime.collection(slug).find({
        query: `where[filename][equals]=${filename}`,
        draft: true,
        locale,
        limit: slug === selfSlug ? 2 : 1
      });
      const referenced = docs.some((doc) => slug !== selfSlug || doc.id !== selfId);
      if (referenced) return true;
    }
  }
  return false;
};

export const cleanUpDocumentFile = async <C extends Config>(args: {
  config: WithUpload<BuiltCollection>;
  rime: RimeContext<C>;
  id: string;
}): Promise<GenericDoc> => {
  //
  const { config, rime, id } = args;
  const doc = await rime.collection<any>(config.slug).findById({ id, draft: true });

  try {
    if (!doc.filename) return doc;

    const stillReferenced = await isFilenameStillReferenced({
      rime,
      filename: doc.filename,
      // The table this document's own filename is in — the same expression `persistRelational`
      // uses, read off the config rather than asked of the adapter.
      selfSlug: config._versions?.slug ?? config.slug,
      // The content row's id — `contentId` rather than `versionId`, so upload names no
      // other feature. See mergeContentRow.
      selfId: doc.contentId ?? doc.id
    });

    if (stillReferenced) return doc;

    const filePath = path.resolve(process.cwd(), `static/medias/${doc.filename}`);

    // Delete original
    unlinkSync(filePath);

    const unlinkPath = (sizePath: string) => {
      if (existsSync(sizePath)) {
        unlink(sizePath, () => {});
      }
    };

    // Process all entries in doc.sizes
    if (doc.sizes) {
      Object.values(doc.sizes).forEach((path) => {
        if (typeof path === 'string') {
          unlinkPath(`static/${path}`);
        }
      });
    }
  } catch (err: any) {
    logger.error(err);
  }
  return doc;
};
