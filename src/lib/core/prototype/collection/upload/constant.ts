/**
 * How an upload path is spelled: `root:folder:sub`.
 *
 * Lived in `core/constants.ts`. The separator and the root's name are this feature's format, and
 * nothing outside it — bar the panel, which renders the folders — has any reason to know either.
 */
export const UPLOAD_PATH = {
  SEPARATOR: ':',
  ROOT_NAME: 'root'
} as const;
