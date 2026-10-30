import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { jsonFileToFile } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import { isFile } from '#lib/util/file.js';

/**
 * Runs before a create or an update on an upload collection: turns a file sent as JSON
 * (`{ base64, filename }`) into a `File` for `processFileUpload`, which writes the row's
 * `filename`, `mimeType` and `filesize`.
 */
export const castBase64ToFile = Hooks.beforeUpsert<'upload'>(async function castBase64ToFile(args) {
  let data = args.data;
  if (data?.file && !isFile(data.file)) {
    try {
      const { file } = jsonFileToFile(data.file);
      data = { ...data, file };
    } catch (err: any) {
      if (err instanceof RimeError) throw err;
      args.event.locals.rime.logger.error(
        'Failed to convert base64 string to File object',
        err.message
      );
      throw new RimeError(RimeError.UPLOAD, 'Unable to process file');
    }
  }
  return { ...args, data };
});
