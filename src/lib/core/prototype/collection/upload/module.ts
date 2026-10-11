import type { UploadConfig } from '#lib/core/prototype/collection/upload/types.js';
import { text } from '#lib/fields/text/index.js';
import { toCamelCase } from '#lib/util/string.js';
import type { Collection } from '#lib/core/config/types.js';
import type { ImageSizesConfig } from '#lib/core/prototype/collection/upload/types.js';
import type { WithNormalizedUpload } from './types.js';
import { validatePath } from './util/path.js';

/**
 * The upload feature's client half — the augment as it runs on both sides.
 *
 * `$rime/modules` resolves this file on a client build and `module.server.ts` on a server one, so
 * the two halves share the export name `augmentUpload` and only the file differs. The server half
 * adds a foreign key the client config must not carry; everything else is here.
 *
 * A name only has to be unique within this pair — `$rime/modules:core/prototype/collection/upload`
 * names the folder. The type still lives in types.ts: a type exported here would be stubbed as a
 * value on the client.
 */

const withNormalizedUpload = <T extends { upload?: boolean | UploadConfig }>(
  config: T
): WithNormalizedUpload<T> => {
  // Create a new object without the upload property
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
  const { upload } = normalizedUploadConfig;
  if (!upload) return normalizedUploadConfig;

  let fields = [...(config.fields || [])];

  // A size name is a column name: `large-square` -> `largeSquare`
  const sizes = (upload.imageSizes ?? []).map((size: ImageSizesConfig) => ({
    ...size,
    name: toCamelCase(size.name)
  }));
  // The panel's thumbnail, unless the config names one
  const hasThumbnail = sizes.some((size) => size.name === 'thumbnail');
  upload.imageSizes = hasThumbnail
    ? sizes
    : [{ name: 'thumbnail', width: 400, compression: 60 }, ...sizes];

  // Written by `processFileUpload` from the saved file, never by a client
  const serverOnly = { create: () => false, update: () => false };

  // One hidden column per size
  const sizesFields = upload.imageSizes.map((size) => text(size.name).hidden().access(serverOnly));
  fields = [...fields, ...sizesFields];

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

  const _pathField = text('_path').$root().hidden().validate(validatePath);

  // Add hidden fields
  fields.push(
    mimeType,
    text('filename').hidden().access(serverOnly),
    text('filesize').hidden(),
    _pathField
  );

  // What an upload document is called, overriding the prototype's fallback. Overrides rather than
  // defers, so upload wins for the rare config carrying both — the `augments` order in
  // `collection/definition.ts` puts this after auth's.
  //
  // `_dashboardLayout` is the same kind of statement: a collection of files reads better as
  // thumbnails than as rows. Offered, not imposed — the dashboard falls back to `'rows'` and an
  // author's `panel.dashboard.layout` wins over both.
  return {
    ...config,
    upload,
    fields,
    _titleFallback: 'filename',
    _dashboardLayout: 'grid' as const
  };
};

/**
 * The derived `<slug>Directories` collections, re-exported so `$rime/modules` collects them.
 *
 * They live in `directories/configure.ts` — the file says the phase — and only a file named
 * `module.ts` or `module.server.ts` is a pair half, so this one re-exports rather than holding
 * the code.
 */
export { configureUploadDirectories } from './directories/configure.js';
