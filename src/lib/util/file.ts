import { slugify } from '#lib/util/string.js';

const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];

/**
 * A size in bytes as text, in decimal units (1 KB = 1000 bytes), two decimals.
 * @example
 * fileSizeToString(500) // "0.50KB"
 * fileSizeToString(999_999) // "1.00MB"
 * fileSizeToString(2_500_000_000) // "2.50GB"
 */
export const fileSizeToString = (size: number) => {
  let value = size / 1000;
  let unit = 0;
  // A value that rounds to 1000.00 moves up a unit
  while (Math.round(value * 100) >= 100_000 && unit < SIZE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(2)}${SIZE_UNITS[unit]}`;
};

/**
 * A file name fit for the medias folder: the name slugified, `file` when nothing of it is left,
 * the extension lower-cased and `jpeg` written `jpg`.
 * @example
 * normalizeFileName("My Photo.JPEG") // { name: "my-photo", extension: "jpg" }
 * normalizeFileName("日本.jpg") // { name: "file", extension: "jpg" }
 */
export const normalizeFileName = (filename: string) => {
  const { name, extension } = fileNameAndExt(filename);
  return {
    name: slugify(name).replace(/^-+|-+$/g, '') || 'file',
    extension: extension.replace('jpeg', 'jpg')
  };
};

/**
 * Type guard to check if a value is a File object
 */
export function isFile(file: any): file is File {
  return file instanceof File;
}

/**
 * Splits a filename into its name and extension parts. A name with no dot, or with its only dot
 * first, has no extension.
 * @example
 * fileNameAndExt("document.pdf") // returns { name: "document", extension: "pdf" }
 * fileNameAndExt("image.with.dots.jpg") // returns { name: "image.with.dots", extension: "jpg" }
 * fileNameAndExt("README") // returns { name: "README", extension: "" }
 */
export const fileNameAndExt = (filename: string) => {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return { name: filename, extension: '' };
  return { name: filename.slice(0, dot), extension: filename.slice(dot + 1).toLowerCase() };
};

/**
 * Joins a name and an extension.
 * @example
 * joinFileName('photo', 'jpg') // 'photo.jpg'
 * joinFileName('readme', '') // 'readme'
 */
export const joinFileName = (name: string, extension: string) =>
  extension ? `${name}.${extension}` : name;
