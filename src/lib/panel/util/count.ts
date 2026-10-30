import { t__ } from '#lib/core/i18n/index.js';

/** The key with the plural modifiers past one: `common.x` for 1, `common.x|m|p` for 2. */
export const byCount = (key: string, count: number) => (count === 1 ? key : `${key}|m|p`);

/**
 * A count in words, singular for one.
 *
 * ```ts
 * counted('common.collection_count_drafts', 3); // '3 drafts'
 * ```
 */
export const counted = (key: string, count: number) => t__(byCount(key, count), String(count));

/**
 * A collection's documents in words: files in an upload collection.
 *
 * ```ts
 * documentsCounted(24, false); // '24 documents'
 * documentsCounted(1, true); // '1 file'
 * ```
 */
export const documentsCounted = (count: number, isUpload: boolean) =>
  counted(isUpload ? 'common.collection_count_files' : 'common.collection_count', count);
