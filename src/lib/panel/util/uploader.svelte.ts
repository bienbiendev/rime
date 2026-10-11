import { t__ } from '#lib/core/i18n/index.js';
import type { UploadDoc } from '#lib/core/prototype/collection/upload/types.js';
import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
import { uploadFiles, type UploadProgress, type UploadTarget } from './upload-file.js';

/**
 * Uploads files into an upload collection and keeps the progress and the failed file names for
 * display. The cache of the collection is refreshed when at least one file arrived. Called while
 * the component initialises: it reads the API proxy's context.
 *
 * ```ts
 * const uploader = createUploader(() => ({ url: apiUrl(config.kebab), path, accept }));
 * const docs = await uploader.upload(files); // [] when every file failed
 * ```
 */
export function createUploader(target: () => UploadTarget) {
  const APIProxy = getAPIProxyContext();
  let progress = $state<UploadProgress | null>(null);
  let failed = $state<string[]>([]);

  async function upload(files: File[]): Promise<UploadDoc[]> {
    failed = [];
    const current = target();
    const result = await uploadFiles(files, current, (state) => (progress = state));
    progress = null;
    failed = result.failed;
    if (result.docs.length) {
      APIProxy.invalidate(current.url);
    }
    return result.docs;
  }

  return {
    get progress() {
      return progress;
    },
    get failed() {
      return failed;
    },
    upload
  };
}

/** "Uploading 2 / 5": the file being sent, counted from 1. */
export const uploadingLabel = (progress: UploadProgress) =>
  t__(
    'fields.uploading',
    String(Math.min(progress.uploaded + progress.failed.length + 1, progress.total)),
    String(progress.total)
  );
