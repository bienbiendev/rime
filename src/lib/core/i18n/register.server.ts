import { namespaces, type Dictionaries, type PanelLanguage } from './index.js';

// Static imports, so the bundler can analyze them.
const translationModules = {
  en: {
    common: () => import('./en/common.js'),
    errors: () => import('./en/errors.js'),
    fields: () => import('./en/fields.js'),
    mail: () => import('./en/mail.js')
  },
  fr: {
    common: () => import('./fr/common.js'),
    errors: () => import('./fr/errors.js'),
    fields: () => import('./fr/fields.js'),
    mail: () => import('./fr/mail.js')
  }
};

/**
 * The four panel dictionaries of `locale`, English for a language rime has no texts for. A
 * namespace that fails to load is left out, the others are kept.
 */
export async function registerTranslation(locale: PanelLanguage) {
  const modules = translationModules[locale];
  if (!modules) {
    console.error(`No panel translations for "${locale}", English is used`);
  }
  const loaded = await Promise.allSettled(
    namespaces.map(
      async (namespace) =>
        [namespace, (await (modules ?? translationModules.en)[namespace]()).default] as const
    )
  );
  for (const result of loaded) {
    if (result.status === 'rejected') {
      console.error(`Failed to load the "${locale}" panel translations:`, result.reason);
    }
  }
  return Object.fromEntries(
    loaded.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  ) as Partial<Dictionaries>;
}
