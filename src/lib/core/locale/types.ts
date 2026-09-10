/**
 * Which languages a config speaks.
 *
 * `core/locale/` because locale is one of the four things core and the adapter may name — the
 * adapter says `locale` 18 times in the contract — and it extends no prototype.
 */
export type LocalizationConfig = {
  locales: LocaleConfig[];
  default: string;
};

export type LocaleConfig = {
  code: string;
  label: string;
};
