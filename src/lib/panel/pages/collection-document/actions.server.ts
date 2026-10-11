import { PARAMS } from '#lib/core/constants.js';
import { formFailure } from '#lib/core/errors/handler.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import { extractData } from '#lib/core/pipeline/extract-data.server.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { answerSave, saveParams } from '#lib/panel/pages/shared/save.server.js';
import { trycatch } from '#lib/util/function.js';
import { type Actions, type RequestEvent } from '@sveltejs/kit';
import { t__ } from '../../../core/i18n/index.js';

export const collectionFormActions: Actions = {
  /**
   * Create a document.
   * Action called when posting a form from the panel :
   * /panel/{slug}/create
   */
  create: async (event: RequestEvent) => {
    const { rime, locale } = event.locals;

    const slug = rime.routes.slug;
    if (!rime.config.isCollection(slug)) throw new RimeError(RimeError.NOT_FOUND);

    // Get the redirect parameter ex: ?redirect=false that can be present if we're in a nested form
    // to prevent redirection after entry creation ex: for relation creation
    const withoutRedirect = event.url.searchParams.get(PARAMS.REDIRECT) === 'false';

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) return formFailure(extractError);

    const collection = rime.collection(slug);

    const [error, document] = await trycatch(() => collection.create({ data, locale }));
    if (error) return formFailure(error);

    if (withoutRedirect) {
      return {
        document,
        message: t__('common.doc_created')
      };
    }

    // Redirect to proper upload directory if collection.upload
    const params = collection.config.upload
      ? `?${PARAMS.UPLOAD_PATH}=${data._path || UPLOAD_PATH.ROOT_NAME}`
      : '';
    const redirectUrl = rime.routes.panelUrl(collection.config.kebab, document.id) + params;

    return {
      redirectUrl,
      document,
      message: t__('common.doc_created')
    };
  },

  /**
   * Update a document.
   * Action called when posting a form from the panel :
   * /panel/{slug}/{documentId}
   */
  update: async (event: RequestEvent) => {
    const { rime, locale } = event.locals;
    const slug = rime.routes.slug || '';
    const id = event.params.id || '';
    if (!rime.config.isCollection(slug)) throw new RimeError(RimeError.NOT_FOUND);
    const collection = rime.collection(slug);
    const { versionId, fork, autoSave } = saveParams(event);

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) return formFailure(extractError);

    const [error, document] = await trycatch(() =>
      collection.updateById({ id, data, versionId, fork, autoSave, locale })
    );
    if (error) return formFailure(error);

    const documentUrl = rime.routes.panelUrl(collection.config.kebab, document.id);
    return answerSave({ event, config: collection.config, document, fork, autoSave, documentUrl });
  }
};
