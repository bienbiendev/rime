import { cleanupStoredFiles } from '$lib/core/collections/upload/disk/delete.server.js';
import { saveFile } from '$lib/core/collections/upload/disk/save.server.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { omit } from '$lib/util/object.js';
import { toCamelCase } from '$lib/util/string.js';
import { isUploadConfig } from '../util/config.js';

/**
 * Hook that handles file upload processing and image resizing operations.
 *
 * @description
 * This hook performs the following operations:
 * 1. For new files:
 *    - Saves the uploaded file to storage
 *    - Generates different image sizes if configured
 *    - Updates document with file metadata and image variations
 *
 * 2. For file updates:
 *    - Removes old files from storage
 *    - Processes new file as above
 *
 * 3. For file deletions:
 *    - Removes files from storage
 *    - Cleans up image variations
 *    - Nullifies related document fields
 */
export const processFileUpload = Hooks.beforeUpsert<'upload'>(async (args) => {
  const { operation, config, event } = args;
  const { rime } = event.locals;

  if (!isUploadConfig(config)) throw new Error('Should never throw');

  let data = args.data || {};
  const hasSizeConfig = 'imageSizes' in config.upload && Array.isArray(config.upload.imageSizes);
  const sizesConfig = hasSizeConfig ? config.upload.imageSizes : [];

  if (data.file) {
    if (operation === 'update' && args.context.originalDoc) {
      await cleanupStoredFiles({ config, rime, id: args.context.originalDoc.id });
    }
    const { filename, imageSizes } = await saveFile(data.file, sizesConfig!);
    data = {
      ...omit(['file'], data),
      filename,
      ...imageSizes
    };
  }

  // If data.file is explicitly set to null : delete file
  if (data.file === null) {
    // delete files
    if (operation === 'update' && args.context.originalDoc) {
      await cleanupStoredFiles({ config, rime, id: args.context.originalDoc.id });
    }
    // update data for DB update
    for (const size of sizesConfig!) {
      data = {
        ...data,
        [toCamelCase(size.name)]: null
      };
    }
  }

  return { ...args, data };
});
