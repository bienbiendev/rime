import { Hooks } from '#lib/core/pipeline/define-hook.js';

/**
 * Puts the request's locale on the document, when a locale is set, the document has none, and the
 * caller did not `select` their way out of it.
 */
export const setDocumentLocale = Hooks.beforeRead<'generic'>(
  async function setDocumentLocale(args) {
    let doc = args.doc;

    const hasSelect =
      Array.isArray(args.context.params.select) && args.context.params.select.length;
    const locale = args.context.params.locale || args.event.locals.locale;
    const shouldSetLocale =
      locale && !doc.locale && (!hasSelect || args.context.params.select?.includes('locale'));

    if (shouldSetLocale) {
      doc = { ...doc, locale };
    }

    return { ...args, doc };
  }
);
