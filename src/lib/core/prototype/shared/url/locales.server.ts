import type { RequestEvent } from '@sveltejs/kit';

/** The locales a document has an address in: `''` when the config has no localization. */
export const addressLocales = (event: RequestEvent) => {
  const codes = event.locals.rime.config.getLocalesCodes();
  return codes.length ? codes : [''];
};
