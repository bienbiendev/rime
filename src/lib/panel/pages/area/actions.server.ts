import { PARAMS } from '$lib/core/constant.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import type { AreaSlug } from '$lib/core/types/doc.js';
import { panelUrl } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { t__ } from '../../../core/i18n/index.js';

export default function (slug: AreaSlug) {
  const actions = {
    update: async (event: RequestEvent) => {
      const { rime, locale } = event.locals;

      const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
      const draft = event.url.searchParams.get(PARAMS.DRAFT) === 'true';

      const data = await extractData(event.request);

      const [error, document] = await trycatch(() =>
        rime.area(slug).update({
          data,
          versionId,
          draft,
          locale
        })
      );

      if (error) {
        return handleError(error, { context: ERROR_CONTEXT.ACTION });
      }

      if (draft && 'versionId' in document) {
        const referer = event.request.headers.get('referer');
        if (referer && referer.includes('/versions')) {
          return redirect(
            303,
            `${panelUrl(toKebabCase(slug))}/versions?versionId=${document.versionId}`
          );
        } else {
          return redirect(303, `${panelUrl(toKebabCase(slug))}?versionId=${document.versionId}`);
        }
      }

      return { document, message: t__('common.doc_updated') };
    }
  };
  return actions;
}
