import { invalidateAll } from '$app/navigation';
import { PARAMS } from '#lib/core/constants.js';
import { t__ } from '#lib/core/i18n/index.js';
import type { VersionsStatus } from '#lib/core/prototype/shared/versions/constant.js';
import { apiUrl } from '#lib/core/routes/util.js';
import type { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
import { documentSegments } from '#lib/panel/util/url.js';
import { toast } from 'svelte-sonner';

/**
 * Sets the status of the row on screen, without a save, then takes it into the form without
 * dirtying it and reloads the page data and the version history.
 *
 * ```
 * PATCH /api/news/n1?versionId=v2   { status: 'published' }
 * ```
 */
export async function setVersionStatus(
  form: DocumentFormContext,
  APIProxy: ReturnType<typeof getAPIProxyContext>,
  next: VersionsStatus
) {
  const url = apiUrl(...documentSegments(form.config.kebab, form.values));
  const response = await fetch(`${url}?${PARAMS.VERSION_ID}=${form.values.versionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: next })
  }).catch(() => null);

  if (response?.status !== 200) {
    toast.error(t__('common.generic_error'));
    return;
  }

  toast.success(t__('common.doc_updated'));
  // The server holds the new status already: the form takes it without getting dirty, so no
  // auto-save follows a publish.
  form.sync('status', next);
  invalidateAll();
  // The write went around the form: the version history re-reads its statuses. `apiUrl(kebab)`
  // reaches `/api/<kebab>--versions` because `invalidate` matches by substring (api-proxy.svelte.ts).
  APIProxy.invalidate(apiUrl(form.config.kebab));
}
