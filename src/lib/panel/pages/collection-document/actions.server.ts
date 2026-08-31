import { PARAMS, UPLOAD_PATH } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import { panelUrlFor } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';
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
    const panelSegment = event.params.panel;

    const slug = event.params.slug;
    if (!rime.config.isCollection(slug)) {
      throw handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.ACTION });
    }

    // Get the redirect parameter ex: ?redirect=false that can be present if we're in a nested form
    // to prevent redirection after entry creation ex: for relation creation
    const withoutRedirect = event.url.searchParams.get(PARAMS.REDIRECT) === 'false';

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) {
      return handleError(extractError, { context: ERROR_CONTEXT.ACTION });
    }

    if (!rime.config.isCollection(slug)) {
      throw handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.ACTION });
    }
    const collection = rime.collection(slug);

    const [error, document] = await trycatch(() => collection.create({ data, locale }));

    if (error) {
      return handleError(error, { context: ERROR_CONTEXT.ACTION });
    }

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
    const redirectUrl = `${panelUrlFor(panelSegment, toKebabCase(slug), document.id)}${params}`;

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
    const panelSegment = event.params.panel;
    const slug = event.params.slug || '';
    const id = event.params.id || '';
    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const draft = event.url.searchParams.get(PARAMS.DRAFT) === 'true';

    if (!rime.config.isCollection(slug)) {
      throw handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.ACTION });
    }

    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) {
      return handleError(extractError, { context: ERROR_CONTEXT.ACTION });
    }

    const [error, document] = await trycatch(() =>
      rime.collection(slug).updateById({
        id,
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
      return {
        document,
        message: t__('common.version_created'),
        redirectUrl: `${panelUrlFor(panelSegment, toKebabCase(slug), document.id)}/versions?versionId=${document.versionId}`
      };
    }

    return {
      document,
      message: t__('common.doc_updated')
    };
  }
};
