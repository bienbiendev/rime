import { t__ } from '#lib/core/i18n/index.js';
import { byCount, documentsCounted } from '#lib/panel/util/count.js';

/**
 * What the panel says once a bulk delete answers: the documents the answer lists went, and a row
 * the caller may not delete stayed. An upload collection counts files.
 *
 * ```ts
 * deletedToast(3, 3, false); // { kind: 'success', message: '3 documents deleted' }
 * deletedToast(3, 2, true); // { kind: 'warning', message: '1 of 3 files could not be deleted' }
 * ```
 */
export const deletedToast = (asked: number, deleted: number, isUpload: boolean) => {
  if (deleted < asked) {
    const kept = asked - deleted;
    const message = t__(
      byCount('common.docs_not_deleted', kept),
      String(kept),
      documentsCounted(asked, isUpload)
    );
    return { kind: 'warning' as const, message };
  }
  const message = t__(byCount('common.docs_deleted', deleted), documentsCounted(deleted, isUpload));
  return { kind: 'success' as const, message };
};
