import path from 'node:path';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { RimeError } from '#lib/core/errors/index.js';
import { trycatchSync } from '#lib/util/function.js';
import { UPLOADS } from '../constant.js';

/** What names a collection's folder: `upload.folder`, else its kebab. */
export type FilesConfig = { kebab: string; upload?: { folder?: string } };

/**
 * Whether a collection's files are served only to its readers: an anonymous caller may not read
 * its documents. A rule that throws without a user counts as a no.
 *
 * ```ts
 * isPrivateUpload({ access: { read: isStaff } }); // true
 * isPrivateUpload({ access: { read: () => true } }); // false
 * isPrivateUpload({ access: { read: (user) => user!.isStaff } }); // true
 * ```
 */
export const isPrivateUpload = (config: { access: Pick<BuiltCollection['access'], 'read'> }) => {
  const [error, readable] = trycatchSync(() => config.access.read(undefined, {}));
  return !!error || !readable;
};

/**
 * The collection whose folder holds a config's files: the config itself, or the collection a
 * versions collection shadows.
 *
 * ```ts
 * filesOwner(rime.config, medias);         // medias
 * filesOwner(rime.config, mediasVersions); // medias
 * ```
 */
export const filesOwner = (
  configs: { getCollection: (slug: string) => FilesConfig },
  config: FilesConfig & { _shadowOf?: string }
): FilesConfig => (config._shadowOf ? configs.getCollection(config._shadowOf) : config);

/**
 * The name of a collection's folder, and of its URL segment.
 *
 * ```ts
 * mediasFolder({ kebab: 'private-medias' });                          // 'private-medias'
 * mediasFolder({ kebab: 'private-medias', upload: { folder: 'docs' } }); // 'docs'
 * ```
 */
export const mediasFolder = (config: FilesConfig) => config.upload?.folder ?? config.kebab;

/** The folder a collection's files live in, absolute: `<cwd>/storage/uploads/<folder>`. */
export const mediasDirectory = (config: FilesConfig) =>
  path.resolve(process.cwd(), UPLOADS.DIRECTORY, mediasFolder(config));

/**
 * The absolute path of an uploaded file of a collection.
 * A name with a folder in it, `.` or `..` throws: a stored filename names a file in the folder.
 *
 * ```ts
 * mediaFilePath(medias, 'photo.jpg');  // '<cwd>/storage/uploads/medias/photo.jpg'
 * mediaFilePath(medias, '../../.env'); // throws RimeError.UPLOAD
 * ```
 */
export const mediaFilePath = (config: FilesConfig, filename: string) => {
  if (filename !== path.basename(filename) || filename === '.' || filename === '..') {
    throw new RimeError(RimeError.UPLOAD, `Invalid file name: ${filename}`);
  }
  return path.resolve(mediasDirectory(config), filename);
};
