import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import type { Access } from '$lib/core/config/types.js';
import type { CollectionHooks } from '$lib/core/config/types.js';
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

declare module '$lib/core/prototype/types.js' {
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

import type { AtLeastOne } from '$lib/util/types.js';

/** What an author writes under `upload`, and the image sizes it may ask for. */
export type UploadConfig = {
  /**
   * Define image sizes that will be generated when an image is uploaded.
   * A 'thumbnail' size will be added, if none provided with this name.
   * @example
   * ```typescript
   * imageSizes: [
   *   {
   *     name: 'thumbnail',
   *     width: 200,
   *     height: 200,
   *     out: ['jpg', 'webp'],
   *     compression: 80
   *   },
   *   {
   *     name: 'medium',
   *     width: 800,
   *     compression: 85
   *   }
   * ]
   * ```
   */
  imageSizes?: ImageSizesConfig[];
  /**
   * Allowed mimeTypes
   * @example
   * ```typescript
   * accept: ['image/jpeg', 'image/svg']
   * ```
   */
  accept?: string[];
  /** Directories */
  directories?: {
    fields: FieldBuilder<Field>[];
    access?: Access;
    // @TODO better types
    $hooks?: CollectionHooks<any>;
  };
};

export type ImageSizesConfig = {
  name: string;
  /** If none provided, will fallback to original file extesion */
  out?: Array<'jpg' | 'webp'>;
  /** Default compression: 60 */
  compression?: number;
} & AtLeastOne<{
  width: number;
  height: number;
}>;
