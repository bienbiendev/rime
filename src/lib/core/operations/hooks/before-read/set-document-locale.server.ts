import { Hooks } from '../index.server.js';

export const setDocumentLocale = Hooks.beforeRead<'generic'>(async (args) => {
  let doc = args.doc;

  // Set doc.locale only if :
  // - locale is defined meaning that the config has a localized prop
  // AND
  // - the 'select' param includes 'locale' or no 'select' param at all
  const hasSelect = Array.isArray(args.context.params.select) && args.context.params.select.length;
  const locale = args.context.params.locale || args.event.locals.locale;
  const shouldSetLocale =
    locale && !doc.locale && (!hasSelect || args.context.params.select?.includes('locale'));

  if (shouldSetLocale) {
    doc = { ...doc, locale: args.event.locals.locale };
  }

  return { ...args, doc };
});
