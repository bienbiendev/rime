import { formFailure } from '#lib/core/errors/handler.server.js';
import { extractData } from '#lib/core/pipeline/extract-data.server.js';
import type { AreaSlug } from '#lib/core/prototype/types.js';
import { answerSave, saveParams } from '#lib/panel/pages/shared/save.server.js';
import { trycatch } from '#lib/util/function.js';
import { type Actions, type RequestEvent } from '@sveltejs/kit';

export const areaFormActions: Actions = {
  update: async (event: RequestEvent) => {
    const { rime, locale } = event.locals;
    const area = rime.area((rime.routes.slug || '') as AreaSlug);
    const { versionId, fork, autoSave } = saveParams(event);

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) return formFailure(extractError);

    const [error, document] = await trycatch(() =>
      area.update({ data, versionId, fork, autoSave, locale })
    );
    if (error) return formFailure(error);

    const documentUrl = rime.routes.panelUrl(area.config.kebab);
    return answerSave({ event, config: area.config, document, fork, autoSave, documentUrl });
  }
};
