import type { UploadConfig } from '$lib/core/factory/config/types.js';
import { text } from '$lib/fields/text/index.js';
import { toCamelCase } from '$lib/util/string.js';
import type { Collection, ImageSizesConfig } from '$lib/core/factory/config/types.js';
import type { WithNormalizedUpload } from './types.js';
import { validatePath } from './util/path.js';

/**
 * The upload feature's client half — the augment as it runs on both sides.
 *
 * `$rime/modules` resolves this file on a client build and `module.server.ts` on a server one, so
 * the two halves share the export name `augmentUpload` and only the file differs. The server half
 * adds a foreign key the client config must not carry; everything else is here.
 *
 * Export names are unique across the whole package by necessity — they all land in one virtual
 * barrel — hence `augmentUpload` rather than a bare `augment`, and hence the type lives in
 * types.ts: a type exported here would be stubbed as a value on the client.
 */

const withNormalizedUpload = <T extends { upload?: boolean | UploadConfig }>(
  config: T
): WithNormalizedUpload<T> => {
  // Create a new object without the auth property
  const { upload, ...rest } = config;
  // Determine the normalized upload value
  let normalizedUpload: undefined | UploadConfig;

  if (typeof upload === 'boolean') {
    normalizedUpload = upload === true ? {} : undefined;
  } else {
    normalizedUpload = upload;
  }

  // Return the new object with the normalized upload
  return {
    ...rest,
    upload: normalizedUpload
  };
};

/**
 * Normalize config.upload and imagesSizes
 * add corresponding fields with validation if config.upload.accept is defined
 */
export const augmentUpload = <T extends Collection<any>>(config: T): WithNormalizedUpload<T> => {
  const normalizedUploadConfig = withNormalizedUpload(config);
  if (!normalizedUploadConfig.upload) return normalizedUploadConfig;

  const { upload } = normalizedUploadConfig;
  let fields = [...(config.fields || [])];

  if (upload) {
    // Add panel thumbnail size if not already present
    const isPanelThumbnailInSizes =
      upload.imageSizes &&
      upload.imageSizes.some((size: ImageSizesConfig) => size.name === 'thumbnail');
    if (!isPanelThumbnailInSizes) {
      const thumbnailSize = { name: 'thumbnail', width: 400, compression: 60 };
      upload.imageSizes = [thumbnailSize, ...(upload.imageSizes || [])];
    }

    // Add image size fields
    if ('imageSizes' in upload && upload.imageSizes?.length) {
      const sizesFields = upload.imageSizes.map((size: ImageSizesConfig) =>
        text(toCamelCase(size.name)).hidden()
      );
      fields = [...fields, ...sizesFields];
    }

    // Add mimeType field
    const mimeType = text('mimeType').table({ sort: true, position: 99 }).hidden();

    // Add validation if accept is defined
    if ('accept' in upload && Array.isArray(upload.accept)) {
      const allowedMimeTypes = upload.accept;
      mimeType.validate((value) => {
        return (
          (typeof value === 'string' && allowedMimeTypes.includes(value)) ||
          `File should be the type of ${allowedMimeTypes.toString()}`
        );
      });
    }

    const _pathField = text('_path')._root().hidden().validate(validatePath);

    // Add hidden fields
    fields.push(mimeType, text('filename').hidden(), text('filesize').hidden(), _pathField);
  }

  // What an upload document is called, offered to the `title` feature rather than guessed at by
  // it. Overwrites: the old switch in augmentTitle tested `upload` before `auth`, so upload wins
  // for the rare config carrying both, and registry order puts this after auth's own offer.
  return { ...config, upload: upload || false, fields, $titleFallback: 'filename' };
};
