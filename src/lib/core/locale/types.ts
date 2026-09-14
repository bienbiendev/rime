/**
 * Which languages a config speaks.
 *
 * `core/locale/` because locale is one of the four things core and the adapter may name — the
 * adapter says `locale` 18 times in the contract — and it extends no prototype.
 */
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

export type LocaleConfig = {
  code: string;
  label: string;
};
