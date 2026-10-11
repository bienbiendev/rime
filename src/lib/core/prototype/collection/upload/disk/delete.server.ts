import {
  filesOwner,
  mediaFilePath,
  mediasDirectory
} from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import type { BuiltCollection, Config } from '#lib/core/config/types.js';
import { logger } from '#lib/core/logger.server.js';
import type { RimeContext } from '#lib/core/rime.server.js';
import { trycatch, trycatchSync } from '#lib/util/function.js';
import type { Dic } from '#lib/util/types.js';
import { rmSync } from 'fs';
import path from 'path';

/**
 * Whether this collection's **own table** holds `name` — which is the only question this file has
 * about where a filename can be.
 *
 * A config with a versions table keeps only its `$root()` fields on its own table; everything else is the
 * versions's, and the versions table is a registered collection in its own right. `filename` is not a root
 * field (only `_path` is, on upload), so on a versioned upload collection it lives on the versions table
 * and the base table has no such column at all.
 */
const ownsField = (config: BuiltCollection, name: string): boolean => {
  const field = config.fields.find((one) => one.name === name);
  if (!field) return false;

  return config._versions ? !!field.get.root : true;
};

/**
 * A given filename on disk can be shared by several document rows of one upload collection —
 * saveFile dedupes any byte-identical upload to a single file of the collection's folder (see
 * isSameFile). Only the tables whose files live in `directory` are scanned: the collection that
 * owns the folder, and its versions.
 *
 * The scan goes table by table, not collection by collection, and that distinction is load-bearing
 * for a collection whose content lives on a versions table: querying the *collection* returns one row per
 * document (the read joins in a single content row), so a filename referenced only by an older
 * revision would be missed and the file deleted out from under it. Querying the versions table directly
 * sees every revision. `ownsField` above is what picks the right table without knowing why there
 * are two.
 *
 * Every configured locale is checked since a localized collection's query can otherwise miss rows
 * in non-default locales, even though `filename` itself is never a localized field.
 */
const isFilenameReferenced = async <C extends Config>(args: {
  rime: RimeContext<C>;
  directory: string;
  filename: string;
}): Promise<boolean> => {
  const { rime, directory, filename } = args;

  // Every table a row carrying this filename could be in. `upload` narrows it to collections that
  // store files at all, `directory` to those of the same folder; `ownsField` picks the one table
  // of each that actually has the column.
  const targetSlugs = Object.values(rime.config.collections)
    .filter((c) => c?.upload && ownsField(c, 'filename'))
    .filter((c) => mediasDirectory(filesOwner(rime.config, c)) === directory)
    .map((c) => c.slug);

  const locales = rime.config.getLocalesCodes();
  const localesToQuery = locales.length ? locales : [undefined];

  // As rime: a row the caller may not read still uses the file
  for (const slug of targetSlugs) {
    for (const locale of localesToQuery) {
      const docs = await rime
        .collection(slug)
        .system()
        .find({
          query: `where[filename][equals]=${encodeURIComponent(filename)}`,
          latest: true,
          locale,
          limit: 1
        });
      if (docs.length > 0) return true;
    }
  }
  return false;
};

/** A stored file and its image sizes, as one upload row names them. */
export type RowFiles = { filename: string; files: string[] };

/**
 * The files an upload document as read uses: its own file and each image size, by name. A size
 * URL ends with the file's name.
 * `null` for a document with no file.
 *
 * ```ts
 * rowFiles({ filename: 'a.jpg', sizes: { thumbnail: '/uploads/medias/a-thumbnail-400.jpg' } });
 * // { filename: 'a.jpg', files: ['a.jpg', 'a-thumbnail-400.jpg'] }
 * ```
 */
export const rowFiles = (doc: Dic | undefined): RowFiles | null => {
  if (!doc?.filename) return null;
  const sizes = Object.values(doc.sizes ?? {})
    .filter((url): url is string => typeof url === 'string')
    .map((url) => path.posix.basename(url));
  return { filename: doc.filename, files: [...new Set([doc.filename, ...sizes])] };
};

/**
 * Deletes each file of `config`'s folder whose `filename` no row of an upload collection of that
 * folder names. Runs after the write, so the rows just replaced or deleted no longer count.
 * Errors are logged, not thrown.
 */
export const removeUnusedFiles = async <C extends Config>(args: {
  rime: RimeContext<C>;
  config: BuiltCollection;
  stored: RowFiles[];
}) => {
  const owner = filesOwner(args.rime.config, args.config);
  const directory = mediasDirectory(owner);

  // Rows sharing a file can name different size files: each filename takes all of them
  const byFilename = new Map<string, Set<string>>();
  for (const { filename, files } of args.stored) {
    byFilename.set(filename, new Set([...(byFilename.get(filename) ?? []), ...files]));
  }
  for (const [filename, files] of byFilename) {
    const [error, used] = await trycatch(() =>
      isFilenameReferenced({ rime: args.rime, directory, filename })
    );
    if (error) {
      logger.error(error);
      continue;
    }
    if (used) continue;
    for (const name of files) {
      const [rmError] = trycatchSync(() => rmSync(mediaFilePath(owner, name), { force: true }));
      if (rmError) {
        logger.error(rmError);
      }
    }
  }
};
