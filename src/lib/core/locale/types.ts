/** Which languages a config's documents are written in, and the default one. */
export type LocalizationConfig = {
  locales: LocaleConfig[];
  default: string;
  /**
   * Whether a read fills what a locale has not written yet from the other locales — the
   * requested locale, then the default, then the rest in config order, field by field. `true`
   * unless said otherwise; `false` reads one locale only, untranslated fields empty.
   */
  fallback?: boolean;
};

/** One language: its code, `fr`, and the label the panel shows, `Français`. */
export type LocaleConfig = {
  code: string;
  label: string;
};
