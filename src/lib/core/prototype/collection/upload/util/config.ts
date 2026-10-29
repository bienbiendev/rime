import type { UploadConfig } from '#lib/core/prototype/collection/upload/types.js';

/** A config whose `upload` is an object, as the upload augment leaves it. */
export type WithUpload<T extends { upload?: boolean | UploadConfig }> = T & {
  upload: UploadConfig;
};

/**
 * Type guard to check if a configuration has upload capabilities
 * @example
 * if (isUploadConfig(collection)) {
 *   // Handle upload-specific functionality
 * }
 */
export function isUploadConfig<C extends { upload?: UploadConfig }>(
  config: C
): config is WithUpload<C> {
  return Boolean('upload' in config && config.upload);
}
