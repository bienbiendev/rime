export const languages = ['fr', 'en'] as const;
export const namespaces = ['errors', 'fields', 'common', 'mail'] as const;

export type PanelLanguage = (typeof languages)[number];
export type Namespace = (typeof namespaces)[number];
export type Dictionaries = Record<string, Record<string, string>>;
export type TranslationKey = `${Namespace}.${string}`;
export type ModifiedKey = `${TranslationKey}|${'m' | 'f'}` | `${TranslationKey}|${'m' | 'f'}|p`;

export type Translate = (key: TranslationKey | ModifiedKey | string, ...params: string[]) => string;

/** A translator over one set of dictionaries. */
export type I18n = { t__: Translate };

/**
 * A translator over the dictionaries it is given, sharing nothing with any other.
 *
 * Dictionaries are keyed by namespace, then by key. A key whose namespace or entry is not there
 * comes back as is. `$1`, `$2`… take the parameters in order. A `{he|she|they|they}` variant in
 * a text is picked by the modifiers on the key: `|m`, `|f`, `|m|p`, `|f|p`.
 *
 * ```ts
 * const { t__ } = createI18n({ site: { hello: 'Hello $1', more: 'more' } });
 * t__('site.hello', 'Ada')  // 'Hello Ada'
 * t__('shop.more')          // 'shop.more'
 * ```
 *
 * A function reads the dictionaries on every call. In a Svelte component, a function over `data`
 * follows a locale switch on its own:
 *
 * ```ts
 * setI18nContext(createI18n(() => data.dictionary));
 * ```
 */
export function createI18n(source: Dictionaries | (() => Dictionaries) = {}): I18n {
  const read = typeof source === 'function' ? source : () => source;
  const templateCache = new Map<string, (gender?: string, plural?: string) => string>();

  const compileTemplate = (text: string) => {
    const cached = templateCache.get(text);
    if (cached) return cached;

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

  const t__: Translate = (key, ...params) => {
    const [baseKey, gender, plural] = key.split('|');
    const dot = baseKey.indexOf('.');
    if (dot === -1) return key;

    const text = read()[baseKey.slice(0, dot)]?.[baseKey.slice(dot + 1)];
    if (text === undefined) return key;

    const resolved = compileTemplate(text)(gender, plural);
    return resolved.replace(/\$(\d+)/g, (_, index) => params[index - 1] ?? '');
  };

  return { t__ };
}

/**
 * The panel's translator, in the panel language the config names.
 *
 * On the server, one instance for the whole process, filled once at boot. In the browser, one per
 * tab, filled by the panel's root layout. An app's own texts go through `createI18n`: feeding
 * this one from a layout would translate the panel for everyone in the language of the last
 * request.
 */
function createPanelI18n() {
  let dictionaries: Dictionaries = {};
  const { t__ } = createI18n(() => dictionaries);

  const init = (loaded: Partial<Dictionaries>) => {
    dictionaries = loaded as Dictionaries;
  };

  const translate: Translate = (key, ...params) => {
    const namespace = key.split('|')[0].split('.')[0] as Namespace;
    if (namespaces.includes(namespace) && !dictionaries[namespace]) {
      console.warn(`Namespace ${namespace} not loaded`);
    }
    return t__(key, ...params);
  };

  return { init, t__: translate };
}

const i18n = createPanelI18n();

export const t__ = i18n.t__;
export default i18n;
