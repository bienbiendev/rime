import { namespaces, type Dictionaries, type PanelLanguage } from './index.js';

// Static mapping of all available translations
// This makes imports statically analyzable by the bundler
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

export async function registerTranslation(locale: PanelLanguage) {
	const dictionaries: Partial<Dictionaries> = {};
	try {
		for (const namespace of namespaces) {
			// Check if we have this language/namespace combination
			if (translationModules[locale]?.[namespace]) {
				// Load the translation module
				const module = await translationModules[locale][namespace]();
				dictionaries[namespace] = module.default;
			} else {
				// Fallback to English if translation not found
				const fallbackLocale = 'en';
				if (translationModules[fallbackLocale]?.[namespace]) {
					console.warn(
						`Translation not found for ${locale}/${namespace}, falling back to ${fallbackLocale}`
					);
					const fallbackModule = await translationModules[fallbackLocale][namespace]();
					dictionaries[namespace] = fallbackModule.default;
				} else {
					console.error(`Translation not found for ${namespace} in any language`);
				}
			}
		}
	} catch (error) {
		console.error(`Failed to load translations:`, error);
	}
	return dictionaries;
}
