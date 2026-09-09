import type { UploadConfig } from '$lib/core/config/types.js';
import type { BaseDoc, GenericDoc } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';
import type { UploadPath } from './util/path.js';

/**
 * What a document of an upload collection carries beyond a plain one.
 *
 * Was in `core/prototype/types.ts`, in the `Docs` registry, which is what made that file import
 * `UploadPath` out of this feature to describe its own type.
 */
export type UploadDoc = BaseDoc & {
  mimeType: string;
  filesize: string;
  filename: string;
  url: string;
  sizes: { [key: string]: string };
} & Dic;

/** A row of the directories tree this feature derives per upload collection. */
export type DirectoryDoc = {
  id: UploadPath;
  parent: string | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

declare module '$lib/core/features/register.js' {
  interface FeatureDocTypes {
    upload: UploadDoc;
    directory: DirectoryDoc;
  }
}

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
