import type { UploadConfig } from '$lib/core/factory/config/types.js';
import type { GenericDoc } from '$lib/types.js';
import type { UploadPath } from './util/path.js';

/** A config whose `upload` has been normalised from `true` to an object by the upload augment. */
export type WithNormalizedUpload<T> = Omit<T, 'upload'> & { upload?: UploadConfig };

export type JsonFile = {
  base64: string;
  filename?: string;
  mimeType?: string;
  filesize?: number;
  lastModified?: number;
};

export type Directory = GenericDoc & {
  id: UploadPath;
  name: string;
  parent: UploadPath | null;
};
