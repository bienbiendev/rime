import { slugify } from '$lib/util/string.js';

/**
 * Converts a file size in bytes to a human-readable string format
 * @example
 * fileSizeToString(500) // returns "0.50KB"
 * fileSizeToString(1500000) // returns "1.50MB"
 */
export const fileSizeToString = (size: number) => {
  if (size < 1_000_000) {
    return (size / 1_000).toFixed(2) + 'KB';
  } else {
    return (size / 1_000_000).toFixed(2) + 'MB';
  }
};

/**
 * Normalizes a filename by slugifying the name and standardizing the extension
 * @example
 * normalizeFileName("My Photo.JPEG") // returns { name: "my-photo", extension: "jpg" }
 * normalizeFileName("Document 1.PDF") // returns { name: "document-1", extension: "pdf" }
 */
export const normalizeFileName = (filename: string) => {
  const { name, extension } = fileNameAndExt(filename);
  const normalizedName = slugify(name);
  const normalizedExtension = extension.toLowerCase().replace('jpeg', 'jpg');
  return {
    name: normalizedName,
    extension: normalizedExtension
  };
};

/**
 * Type guard to check if a value is a File object
 */
export function isFile(file: any): file is File {
  return file instanceof File;
}

/**
 * Splits a filename into its name and extension parts
 * @example
 * fileNameAndExt("document.pdf") // returns { name: "document", extension: "pdf" }
 * fileNameAndExt("image.with.dots.jpg") // returns { name: "image.with.dots", extension: "jpg" }
 */
export const fileNameAndExt = (filename: string) => {
  return {
    name: filename.substring(0, filename.lastIndexOf('.')),
    extension: filename.substring(filename.lastIndexOf('.') + 1, filename.length).toLowerCase()
  };
};
