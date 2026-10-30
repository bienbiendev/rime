/**
 * The file types rime knows, each with its extensions, the canonical one first. A base64 upload
 * of a type outside this map is refused (`jsonFileToFile`).
 */
export const mimeTypesMap: Record<string, string[]> = {
  // Images
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg', 'svgz'],
  'image/bmp': ['bmp'],
  'image/tiff': ['tif', 'tiff'],

  // Documents
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'text/html': ['html', 'htm', 'shtml'],
  'application/xhtml+xml': ['xhtml', 'xht'],

  // Audio
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg'],
  'audio/midi': ['mid', 'midi'],
  'audio/aac': ['aac'],

  // Video
  'video/mp4': ['mp4'],
  'video/mpeg': ['mpeg', 'mpg'],
  'video/quicktime': ['mov'],
  'video/webm': ['webm'],
  'video/x-msvideo': ['avi'],
  'video/x-ms-wmv': ['wmv'],

  // Archives
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-7z-compressed': ['7z'],
  'application/gzip': ['gz'],

  // Code
  'application/json': ['json'],
  'application/xml': ['xml'],
  'application/xslt+xml': ['xsl', 'xslt'],
  'text/javascript': ['js', 'mjs', 'cjs'],
  'text/css': ['css'],
  'application/x-httpd-php': [
    'php',
    'phtml',
    'pht',
    'phps',
    'phar',
    'php3',
    'php4',
    'php5',
    'php7',
    'php8'
  ],
  'application/x-asp': ['asp', 'aspx'],
  'application/x-jsp': ['jsp', 'jspx'],
  'application/x-perl': ['pl', 'cgi'],
  'application/x-python-code': ['py'],

  // Fonts
  'font/ttf': ['ttf'],
  'font/otf': ['otf'],
  'font/woff': ['woff'],
  'font/woff2': ['woff2']
} as const;

/**
 * The canonical extension of a type, `null` for an unknown one.
 *
 * ```ts
 * getExtensionFromMimeType('image/jpeg'); // 'jpg'
 * ```
 */
export function getExtensionFromMimeType(mimeType: string): string | null {
  const extensions = mimeTypesMap[mimeType];
  return extensions ? extensions[0] : null;
}

export function getMimeTypeFromExtension(extension: string): string | null {
  // Remove the dot if present and convert to lowercase
  const ext = extension.replace(/^\./, '').toLowerCase();

  // Find the MIME type that includes this extension
  for (const [mimeType, extensions] of Object.entries(mimeTypesMap)) {
    if (extensions.includes(ext)) {
      return mimeType;
    }
  }
  return null;
}

/**
 * The type a file is served as, by its extension: `application/octet-stream`, which a browser
 * downloads, for an unknown one.
 *
 * ```ts
 * servedMimeType('JPG'); // 'image/jpeg'
 * servedMimeType('');    // 'application/octet-stream'
 * ```
 */
export const servedMimeType = (extension: string) =>
  getMimeTypeFromExtension(extension) ?? 'application/octet-stream';

/**
 * The types an upload takes only when `upload.accept` lists them: a page or a script a browser
 * runs from the site, and a script a server runs. Every image, video and audio type is taken,
 * SVG included: an `<img>` runs no script of it, and `handleUploads` serves it sandboxed.
 */
export const RISKY_MIME_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'application/xml',
  'application/xslt+xml',
  'text/javascript',
  'application/x-httpd-php',
  'application/x-asp',
  'application/x-jsp',
  'application/x-perl',
  'application/x-python-code'
];

/**
 * Whether an upload of this type may be stored. With `accept`, the listed types only; without
 * it, every type but the risky ones.
 *
 * ```ts
 * isAcceptedType('image/png');                        // true
 * isAcceptedType('image/svg+xml');                    // true
 * isAcceptedType('text/html');                        // false
 * isAcceptedType('application/octet-stream');         // true: no extension, or an unknown one
 * isAcceptedType('text/html', ['text/html']);         // true
 * isAcceptedType('image/png', ['image/jpeg']);        // false
 * ```
 */
export const isAcceptedType = (mimeType: string, accept?: string[]) =>
  accept?.length ? accept.includes(mimeType) : !RISKY_MIME_TYPES.includes(mimeType);
