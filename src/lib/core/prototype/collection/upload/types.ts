import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';
import type { Access } from '#lib/core/config/types.js';
import type { CollectionHooks } from '#lib/core/config/types.js';
import type { BaseDoc, GenericDoc } from '#lib/core/prototype/types.js';
import type { AtLeastOne, Dic } from '#lib/util/types.js';
import type { UploadPath } from './util/path.js';

/**
 * What a document of an upload collection carries beyond a plain one.
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

declare module '../../types.js' {
  interface FeatureDocTypes {
    upload: UploadDoc;
    directory: DirectoryDoc;
  }
}

/** A config whose `upload` has been normalised from `true` to an object by the upload augment. */
export type WithNormalizedUpload<T> = Omit<T, 'upload'> & { upload?: UploadConfig };

/**
 * A file sent as JSON: a data URI (`data:image/png;base64,…`) and what the client knows of it.
 * `castBase64ToFile` turns it into a `File`.
 */
export type JsonFile = {
  base64: string;
  filename?: string;
  mimeType?: string;
  filesize?: number;
  lastModified?: number;
};

/** A folder as the panel reads it: `id` is its path (`root:press`), `parent` the path above it. */
export type Directory = GenericDoc & {
  id: UploadPath;
  name: string;
  parent: UploadPath | null;
};

/** What an author writes under `upload`, and the image sizes it may ask for. */
export type UploadConfig = {
  /**
   * The folder the collection's files live in, under `storage/uploads/` at the app root, and the
   * URL segment they are served at. One lowercase segment, its own. The collection's kebab by
   * default.
   * @example
   * ```typescript
   * folder: 'invoices' // storage/uploads/invoices/a.pdf, served at /uploads/invoices/a.pdf
   * ```
   */
  folder?: string;
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
   * The types a file may have, by the extension it is saved under. Without it, every type is
   * taken but the risky ones: pages and scripts a browser or a server runs, such as `.html`,
   * `.svg`, `.xml`, `.js` and `.php` (`RISKY_MIME_TYPES`). A risky type is taken only when it is
   * listed here.
   * @example
   * ```typescript
   * accept: ['image/jpeg', 'image/svg+xml']
   * ```
   */
  accept?: string[];
  /**
   * The derived folders collection: extra fields, its access (the upload collection's by
   * default) and its hooks.
   */
  directories?: {
    fields: FieldBuilder<Field>[];
    access?: Access;
    $hooks?: CollectionHooks<any>;
  };
};

/**
 * An image size generated on upload. `name` is a column of the collection; `width`, `height` or
 * both set the box; `out` lists the formats written (the original's when empty); `compression`
 * is the quality, 60 by default.
 */
export type ImageSizesConfig = {
  name: string;
  /** If none provided, will fall back to the original file extension */
  out?: Array<'jpg' | 'webp'>;
  /** Default compression: 60 */
  compression?: number;
} & AtLeastOne<{
  width: number;
  height: number;
}>;
