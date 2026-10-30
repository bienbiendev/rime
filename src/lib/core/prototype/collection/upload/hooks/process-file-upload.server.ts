import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { rowFiles } from '#lib/core/prototype/collection/upload/disk/delete.server.js';
import { filesOwner } from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import { saveFile } from '#lib/core/prototype/collection/upload/disk/save.server.js';
import { omit } from '#lib/util/object.js';
import { isUploadConfig } from '#lib/core/prototype/collection/upload/util/config.js';
import { uploadType } from '#lib/core/prototype/collection/upload/util/mime.js';
import { RimeError } from '#lib/core/errors/index.js';
import { fileSizeToString } from '#lib/util/file.js';
import type { Dic } from '#lib/util/types.js';

/**
 * Saves the file a write sends, with its image sizes, in the collection's folder, and puts its
 * name, type and size on the row. The type is the one its extension is served as, and a type
 * `upload.accept` does not take answers 400 before anything is saved (`uploadType`).
 *
 * ```
 * file: x.html  400 ".html is not an accepted file type", unless `accept` lists `text/html`
 * file: File    saved; `filename` and each size column name the saved files
 * file: null    the row names no file: `filename`, `mimeType`, `filesize` and the sizes are null
 * no file       nothing changes
 * ```
 *
 * On an update that sends `file`, the files of the row it writes go in `context.replacedFiles`:
 * `cleanUpReplacedFiles` deletes them once the write is done, if no row uses them any more.
 */
export const processFileUpload = Hooks.beforeUpsert<'upload'>(
  async function processFileUpload(args) {
    const { operation, config } = args;

    if (!isUploadConfig(config)) {
      throw new Error('processFileUpload runs on an upload collection only');
    }

    let data = args.data || {};
    const hasSizeConfig = 'imageSizes' in config.upload && Array.isArray(config.upload.imageSizes);
    const sizesConfig = hasSizeConfig ? config.upload.imageSizes : [];

    // The row this update writes: its files go once the write is done, if nothing else uses them
    const replaced = operation === 'update' ? rowFiles(args.context.originalDoc) : null;
    const replacesFile = data.file !== undefined;

    if (data.file) {
      // The type the file is served as, from the extension it is saved under
      const { mimeType, refusal } = uploadType(data.file.name, config.upload.accept);
      if (refusal) {
        throw new RimeError(RimeError.INVALID_DATA, refusal);
      }

      const owner = filesOwner(args.event.locals.rime.config, config);
      const { filename, imageSizes } = await saveFile(owner, data.file, sizesConfig!);
      data = {
        ...omit(['file'], data),
        filename,
        mimeType,
        filesize: fileSizeToString(data.file.size),
        ...imageSizes
      };
    }

    // `file: null` removes the file: the row keeps no name of it, so nothing uses it after the write
    if (data.file === null) {
      const noFile: Dic = { filename: null, mimeType: null, filesize: null };
      for (const size of sizesConfig!) noFile[size.name] = null;
      data = { ...data, ...noFile };
    }

    const replacedFiles = replacesFile && replaced ? [replaced] : [];
    return { ...args, data, context: { ...args.context, replacedFiles } };
  }
);
