import { mediaFilePath, type FilesConfig } from './medias.server.js';
import type { ImageSizesConfig } from '#lib/core/prototype/collection/upload/types.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { UploadDoc } from '#lib/types.js';
import { joinFileName, normalizeFileName } from '#lib/util/file.js';
import { pick } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import crypto from 'crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import sharp from 'sharp';

/**
 * Compares a buffer with an existing file to determine if they are identical
 * Uses file size as a quick check before comparing content hashes
 * @example
 * const identical = isSameFile(fileBuffer, '/path/to/file.jpg');
 * if (identical) {
 *   console.log('Files are the same');
 * }
 */
const isSameFile = (buffer: Buffer, filePath: string): boolean => {
  try {
    // Check if file exists
    if (!existsSync(filePath)) return false;

    // Compare file sizes first (quick check)
    const stats = statSync(filePath);
    if (stats.size !== buffer.length) return false;

    // Compare content hash (more thorough check)
    const existingFileBuffer = readFileSync(filePath);
    const existingFileHash = crypto.createHash('md5').update(existingFileBuffer).digest('hex');
    const newFileHash = crypto.createHash('md5').update(buffer).digest('hex');

    return existingFileHash === newFileHash;
  } catch {
    // If any error occurs during comparison, assume files are different
    return false;
  }
};

/**
 * The file a generated image size is written to.
 *
 * ```ts
 * sizeFileName('photo', { name: 'thumbnail', width: 400 }, 'jpg'); // 'photo-thumbnail-400.jpg'
 * sizeFileName('photo', { name: 'card', width: 800, height: 600 }, 'webp'); // 'photo-card-800x600.webp'
 * sizeFileName('photo', { name: 'tall', height: 900 }, 'jpg'); // 'photo-tall-900.jpg'
 * ```
 */
export const sizeFileName = (name: string, size: ImageSizesConfig, extension: string) => {
  const dimensions = [size.width, size.height].filter(Boolean).join('x');
  return `${name}-${size.name}-${dimensions}.${extension}`;
};

/**
 * Verifies if all image size variations already exist for a given base filename, in the
 * collection's folder.
 * Returns a record of size names to filenames if all exist, empty object otherwise
 * @example
 * const sizes = checkImageSizesExist(config, 'image', 'jpg', imageSizesConfig);
 * if (Object.keys(sizes).length > 0) {
 *   console.log('All image sizes already exist');
 * }
 */
export const checkImageSizesExist = (
  config: FilesConfig,
  name: string,
  extension: string,
  imagesSizes: ImageSizesConfig[]
): Record<string, string> => {
  const sizes: Record<string, string> = {};

  for (const size of imagesSizes) {
    if (!size.out || !size.out.length) {
      // Check if the resized image exists
      const filename = sizeFileName(name, size, extension);
      const filePath = mediaFilePath(config, filename);

      if (!existsSync(filePath)) {
        return {}; // If any size doesn't exist, return empty object
      }

      sizes[size.name] = filename;
    } else {
      // Check if all format conversions exist
      const convertedFilenames: string[] = [];

      for (const format of size.out) {
        const filename = sizeFileName(name, size, format);
        const filePath = mediaFilePath(config, filename);

        if (!existsSync(filePath)) {
          return {}; // If any format doesn't exist, return empty object
        }

        convertedFilenames.push(filename);
      }

      sizes[size.name] = convertedFilenames.join('|');
    }
  }

  return sizes;
};

/**
 * Saves a file to the collection's folder with deduplication and generates image sizes if needed
 * Checks if identical file already exists in that folder before creating a new one
 * @example
 * const file = event.request.formData.get('file');
 * const { filename, imageSizes } = await saveFile(config, file, config.upload.imageSizes);
 */
export const saveFile = async (
  config: FilesConfig,
  file: File,
  imagesSizes: ImageSizesConfig[] | false
) => {
  const { name: initialName, extension } = normalizeFileName(file.name);
  let name = initialName;
  let sizes: UploadDoc['sizes'] = {};
  let filename = joinFileName(name, extension);
  let filePath = mediaFilePath(config, filename);

  // Get buffer once to avoid multiple arrayBuffer() calls
  const buffer = Buffer.from(await file.arrayBuffer());

  // Check if file exists and is identical
  if (existsSync(filePath) && isSameFile(buffer, filePath)) {
    // File already exists and is identical

    // Check if image sizes already exist
    if (imagesSizes && file.type.includes('image') && !file.type.includes('svg')) {
      const existingSizes = checkImageSizesExist(config, name, extension, imagesSizes);

      // If all sizes exist, use them
      if (Object.keys(existingSizes).length > 0) {
        return { filename, imageSizes: existingSizes };
      }

      // Otherwise, we'll need to generate the sizes
      sizes = await generateSizes({
        config,
        name,
        extension,
        sizes: imagesSizes,
        buffer
      });
    }

    return { filename, imageSizes: sizes };
  }

  // File doesn't exist or is different, find a unique name
  while (existsSync(filePath)) {
    name += `-${new Date().getTime().toString()}`;
    filename = joinFileName(name, extension);
    filePath = mediaFilePath(config, filename);
  }

  try {
    writeFileSync(filePath, buffer);
    if (imagesSizes && file.type.includes('image') && !file.type.includes('svg')) {
      sizes = await generateSizes({
        config,
        name,
        extension,
        sizes: imagesSizes,
        buffer
      });
    }
  } catch (error: any) {
    throw new RimeError(RimeError.UPLOAD, `Error while processing file: ${error.message}`);
  }

  return { filename, imageSizes: sizes };
};

/**
 * Generates various image sizes based on configuration
 * Creates resized versions and format conversions as specified
 * @example
 * const sizes = await generateSizes({
 *   config,
 *   name: 'image',
 *   extension: 'jpg',
 *   sizes: imageSizesConfig,
 *   buffer: imageBuffer
 * });
 */
const generateSizes = async ({ config, sizes, buffer, name, extension }: GenerateSizeArgs) => {
  const imageSizes: Dic = {};

  for (const size of sizes) {
    const wh = pick(['width', 'height'], size);
    const resizedImage = sharp(buffer).resize(wh);

    // If no output formats specified, keep original format
    if (!size.out?.length) {
      let resizedBuffer: Buffer;
      const shouldApplyCompression = extension === 'jpg' || extension === 'webp';

      if (shouldApplyCompression) {
        const compression = size.compression || 60;
        if (extension === 'jpg') {
          resizedBuffer = await resizedImage.jpeg({ quality: compression }).toBuffer();
        } else {
          resizedBuffer = await resizedImage.webp({ quality: compression }).toBuffer();
        }
      } else {
        resizedBuffer = await resizedImage.toBuffer();
      }

      const filename = sizeFileName(name, size, extension);
      const filePath = mediaFilePath(config, filename);
      writeFileSync(filePath, resizedBuffer);
      imageSizes[size.name] = filename;
      continue;
    }

    // Handle format conversions
    const convertedFiles = await Promise.all(
      size.out.map(async (format) => {
        const compression = size.compression || 60;
        let convertedImage;

        if (format === 'jpg') {
          convertedImage = await resizedImage.jpeg({ quality: compression }).toBuffer();
        } else {
          convertedImage = await resizedImage.webp({ quality: compression }).toBuffer();
        }

        const filename = sizeFileName(name, size, format);
        const filePath = mediaFilePath(config, filename);
        writeFileSync(filePath, convertedImage);

        return filename;
      })
    );

    imageSizes[size.name] = convertedFiles.join('|');
  }

  return imageSizes;
};

type GenerateSizeArgs = {
  config: FilesConfig;
  sizes: ImageSizesConfig[];
  buffer: Buffer;
  name: string;
  extension: string;
};
