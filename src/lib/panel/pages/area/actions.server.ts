import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/pipeline/extract-data.server.js';
import { retireAutoSaves } from '$lib/core/prototype/shared/versions/retire-auto-saves.server.js';
import type { AreaSlug } from '$lib/core/prototype/types.js';
import { trycatch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';
import { redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { t__ } from '../../../core/i18n/index.js';

export const areaFormActions: Actions = {
  update: async (event: RequestEvent) => {
    const { rime, locale, user } = event.locals;
    const slug = (event.params.slug || '') as AreaSlug;

    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const draft = event.url.searchParams.get(PARAMS.DRAFT) === 'true';
    const autoSave = event.url.searchParams.get(PARAMS.AUTO_SAVE) === 'true';

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) {
      return handleError(extractError, { context: ERROR_CONTEXT.ACTION });
    }

    const area = rime.area(slug);

    const [error, document] = await trycatch(() =>
      area.update({
        data,
        versionId,
        draft,
        autoSave,
        locale
      })
    );

    if (error) {
      return handleError(error, { context: ERROR_CONTEXT.ACTION });
    }

    // An auto-save is silent: the form merges the document back and nothing else moves.
    if (autoSave) {
      return { document };
    }

    // A save is where the saver's auto-saves end, except the row it landed on.
    if (user) {
      await retireAutoSaves({
        event,
        config: area.config,
        docId: document.id,
        userId: user.id,
        keep: document.versionId as string | undefined
      });
    }

    if (draft && 'versionId' in document) {
      const referer = event.request.headers.get('referer');
      if (referer && referer.includes('/versions')) {
        return redirect(
          303,
          `${rime.routes.panelUrl(toKebabCase(slug))}/versions?versionId=${document.versionId}`
        );
      } else {
        return redirect(
          303,
          `${rime.routes.panelUrl(toKebabCase(slug))}?versionId=${document.versionId}`
        );
      }
    }

    return { document, message: t__('common.doc_updated') };
  }
};
