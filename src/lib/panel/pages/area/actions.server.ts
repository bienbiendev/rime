import { PARAMS } from '$lib/core/constant.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/rest/extract-data.server.js';
import type { AreaSlug } from '$lib/core/types/doc.js';
import { panelUrlFor } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';
import { redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { t__ } from '../../../core/i18n/index.js';

export const areaFormActions: Actions = {
  update: async (event: RequestEvent) => {
    const { rime, locale } = event.locals;
    const slug = (event.params.slug || '') as AreaSlug;
    const panelSegment = event.params.panel;

    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const draft = event.url.searchParams.get(PARAMS.DRAFT) === 'true';

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) {
      return handleError(extractError, { context: ERROR_CONTEXT.ACTION });
    }

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
          `${panelUrlFor(panelSegment, toKebabCase(slug))}/versions?versionId=${document.versionId}`
        );
      } else {
        return redirect(
          303,
          `${panelUrlFor(panelSegment, toKebabCase(slug))}?versionId=${document.versionId}`
        );
      }
    }

    return { document, message: t__('common.doc_updated') };
  }
};
