/**
 * How an upload path is spelled: `root:folder:sub`.
 *
 * The separator and the root's name are this feature's format, and nothing outside it — bar the
 * panel, which renders the folders — has any reason to know either.
 */
export const UPLOAD_PATH = {
  SEPARATOR: ':',
  ROOT_NAME: 'root'
} as const;

/**
 * Where uploaded files live: one folder per collection under `DIRECTORY`, from the app root, served
 * by rime at `URL`. The disk path never matches the URL, so no static server finds a file there.
 *
 * ```
 * storage/uploads/private-medias/invoice.pdf   ->   /uploads/private-medias/invoice.pdf
 * ```
 */
export const UPLOADS = {
  DIRECTORY: 'storage/uploads',
  URL: '/uploads'
} as const;
