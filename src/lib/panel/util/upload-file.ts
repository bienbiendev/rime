import { PARAMS } from '$lib/core/constants.js';
import type { UploadDoc } from '$lib/core/prototype/collection/upload/types.js';
import { getExtensionFromMimeType } from '$lib/core/prototype/collection/upload/util/mime.js';
import { trycatchFetch } from '$lib/util/function.js';

/** Where files go: the collection's API url, the folder, and the mime types it takes. */
export type UploadTarget = { url: string; path?: string; accept?: string[] };

/** How a batch goes, after each file. */
export type UploadProgress = {
  total: number;
  uploaded: number;
  /** The names of the files that did not make it. */
  failed: string[];
  /** The name of the file on its way, `null` once the last one is done. */
  current: string | null;
};

/**
 * Whether the collection takes this file. No `accept` takes anything.
 *
 * ```ts
 * isAccepted(photo, ['image/jpeg', 'image/png']) // true for a .jpg
 * ```
 */
export const isAccepted = (file: Pick<File, 'type'>, accept?: string[]) =>
  !accept?.length || accept.includes(file.type);

/**
 * A mime type as people read it.
 *
 * ```ts
 * typeLabel('image/jpeg')      // 'JPG'
 * typeLabel('application/pdf') // 'PDF'
 * ```
 */
export const typeLabel = (mimeType?: string) => {
  if (!mimeType) return '';
  return (getExtensionFromMimeType(mimeType) ?? mimeType.split('/').pop() ?? '').toUpperCase();
};

const BYTES = { B: 1, KB: 1_000, MB: 1_000_000, GB: 1_000_000_000 } as const;

/**
 * A file size in bytes, from a count of bytes or a stored size.
 *
 * ```ts
 * fileSizeBytes('3.20MB') // 3200000
 * fileSizeBytes('0.84KB') // 840
 * fileSizeBytes(840)      // 840
 * fileSizeBytes('')       // null
 * ```
 */
export const fileSizeBytes = (size?: string | number | null): number | null => {
  if (typeof size === 'number') return Number.isFinite(size) ? size : null;
  const match = size?.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!match) return null;
  const unit = (match[2]?.toUpperCase() ?? 'B') as keyof typeof BYTES;
  return Math.round(parseFloat(match[1]) * BYTES[unit]);
};

/**
 * A file size as people read it: whole kilobytes, then one decimal from a megabyte up.
 *
 * ```ts
 * fileSizeLabel('3.20MB')      // '3.2 MB'
 * fileSizeLabel('840.12KB')    // '840 KB'
 * fileSizeLabel(1_240_000_000) // '1.2 GB'
 * fileSizeLabel(512)           // '512 B'
 * ```
 */
export const fileSizeLabel = (size?: string | number | null) => {
  const bytes = fileSizeBytes(size);
  if (bytes === null) return '';
  if (bytes < BYTES.KB) return `${bytes} B`;
  const kilobytes = Math.round(bytes / BYTES.KB);
  if (kilobytes < 1000) return `${kilobytes} KB`;
  const megabytes = bytes / BYTES.MB;
  if (megabytes < 999.95) return `${megabytes.toFixed(1)} MB`;
  return `${(bytes / BYTES.GB).toFixed(1)} GB`;
};

/**
 * A media's size and type, for the line under its name.
 *
 * ```ts
 * mediaMeta({ filesize: '3.20MB', mimeType: 'image/jpeg' }) // '3.2 MB · JPG'
 * ```
 */
export const mediaMeta = (doc: { filesize?: string | number | null; mimeType?: string | null }) =>
  [fileSizeLabel(doc.filesize), typeLabel(doc.mimeType ?? undefined)].filter(Boolean).join(' · ');

export const MEDIA_KINDS = ['image', 'video', 'audio', 'document', 'other'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const DOCUMENT_TYPES =
  /^(text\/|application\/(pdf|rtf|msword|vnd\.ms-|vnd\.openxmlformats-officedocument|vnd\.oasis\.opendocument))/;

/**
 * The kind of file a mime type is, to filter medias by.
 *
 * ```ts
 * mediaKind('image/webp')      // 'image'
 * mediaKind('application/pdf') // 'document'
 * mediaKind('application/zip') // 'other'
 * ```
 */
export const mediaKind = (mimeType?: string | null): MediaKind => {
  const type = mimeType ?? '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (DOCUMENT_TYPES.test(type)) return 'document';
  return 'other';
};

/**
 * The accepted types as a sentence.
 *
 * ```ts
 * acceptLabel(['image/jpeg', 'image/png', 'image/webp'], 'or') // 'JPG, PNG or WEBP'
 * ```
 */
export const acceptLabel = (accept: string[], or: string) => {
  const labels = [...new Set(accept.map(typeLabel))];
  if (labels.length < 2) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} ${or} ${labels.at(-1)}`;
};

const readAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error(`Cannot read ${file.name}`));
    reader.onerror = () => reject(reader.error ?? new Error(`Cannot read ${file.name}`));
    reader.readAsDataURL(file);
  });

/**
 * Creates one document of an upload collection from a file, and answers it.
 * Validation is skipped, so a required field the file cannot fill, like an `alt`, never blocks it.
 *
 * ```ts
 * const doc = await uploadFile(file, { url: '/api/medias', path: 'root:press' });
 * ```
 */
export async function uploadFile(file: File, target: UploadTarget): Promise<UploadDoc> {
  if (!isAccepted(file, target.accept)) {
    throw new Error(`${file.name} is not of an accepted type`);
  }
  const base64 = await readAsDataURL(file);
  const [error, response] = await trycatchFetch(`${target.url}?${PARAMS.SKIP_VALIDATION}=true`, {
    method: 'POST',
    body: JSON.stringify({ _path: target.path, file: { base64, filename: file.name } })
  });
  if (error) throw error;
  const { doc } = await response.json();
  return doc;
}

/**
 * Uploads files one after the other. A file that fails is counted and skipped.
 *
 * ```ts
 * const { docs, failed } = await uploadFiles(files, target, (progress) => (state = progress));
 * ```
 */
export async function uploadFiles(
  files: File[],
  target: UploadTarget,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ docs: UploadDoc[]; failed: string[] }> {
  const docs: UploadDoc[] = [];
  const failed: string[] = [];
  const report = (current: string | null) =>
    onProgress?.({ total: files.length, uploaded: docs.length, failed: [...failed], current });

  for (const file of files) {
    report(file.name);
    try {
      docs.push(await uploadFile(file, target));
    } catch {
      failed.push(file.name);
    }
  }
  report(null);
  return { docs, failed };
}
