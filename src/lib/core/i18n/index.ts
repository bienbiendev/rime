export const languages = ['fr', 'en'] as const;
export const namespaces = ['errors', 'fields', 'common'] as const;
export const DEFAULT_LOCALE = 'en';

export type PanelLanguage = (typeof languages)[number];
export type Namespace = (typeof namespaces)[number];
export type Dictionaries = Record<string, Record<string, string>>;
export type TranslationKey = `${Namespace}.${string}`;
export type ModifiedKey = `${TranslationKey}|${'m' | 'f'}` | `${TranslationKey}|${'m' | 'f'}|p`;

function createI18n() {
	let dictionaries: Partial<Dictionaries> = {};
	const templateCache = new Map<string, (gender?: string, plural?: string) => string>();

	const compileTemplate = (text: string) => {
		if (templateCache.has(text)) {
			return templateCache.get(text)!;
		}

		const compiled = (gender?: string, plural?: string) => {
			return text.replace(/\{([^}]+)\}/g, (_, options) => {
				const variants = options.split('|');
				if (gender === 'f') {
					if (plural) return variants[3]?.trim() || variants[0].trim();
					return variants[1]?.trim() || variants[0].trim();
				}
				if (plural) return variants[2]?.trim() || variants[0].trim();
				return variants[0].trim();
			});
		};

		templateCache.set(text, compiled);
		return compiled;
	};

	const t__ = (key: TranslationKey | ModifiedKey | string, ...params: string[]) => {
		const isNamespacedKey = namespaces.some((ns) => key.startsWith(`${ns}.`));

		if (!isNamespacedKey) {
			return key;
		}

		const [baseKey, gender, plural] = key.split('|');
		const [namespace, translationKey] = baseKey.split('.') as [Namespace, string];

		if (!dictionaries[namespace]) {
			console.warn(`Namespace ${namespace} not loaded`);
		}

		const text = dictionaries[namespace]?.[translationKey] ?? key;
		const compiled = compileTemplate(text);
		const resolved = compiled(gender, plural);

		return resolved.replace(/\$(\d+)/g, (_, index) => params[index - 1] ?? '');
	};

	const init = (newDictionaries: Partial<Dictionaries>) => {
		dictionaries = newDictionaries;
	};

	return {
		init,
		t__
	};
}

let instance: ReturnType<typeof createI18n>;

const getInstance = () => {
	if (instance) return instance;
	instance = createI18n();
	return instance;
};

const i18n = getInstance();

export const t__ = i18n.t__;
export default i18n;
