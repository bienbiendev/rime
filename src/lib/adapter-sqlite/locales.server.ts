import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';

/**
 * Which locales a read in `locale` draws on, first to last.
 *
 * ```
 * requested locale → default locale → the other locales, in config order
 * ```
 *
 * A localized value comes from the first of these that has it, so a document written in one
 * locale reads the same in every locale until it is translated, field by field. Structural
 * fields — blocks, tree, relations — are rows keyed by locale and take no part in this: a locale
 * has the blocks that were written in it, or none.
 *
 * `localization.fallback: false` cuts the list to the requested locale, and a read is one locale
 * only; so does a caller asking for the locale's own rows with `fallback: false`, as a copy from
 * one row to another does. `undefined` when the read names no locale.
 */
export const localeOrder = (
  configCtx: ConfigContext,
  locale?: string,
  fallback = true
): string[] | undefined => {
  if (!locale) return undefined;
  const localization = configCtx.raw.localization;
  if (!fallback || !localization || localization.fallback === false) return [locale];
  const order = [locale, localization.default, ...configCtx.getLocalesCodes()];
  return order.filter((code, index) => order.indexOf(code) === index);
};

/** The columns a locales row carries beside its values. */
const ROW_KEYS = ['id', 'locale', 'ownerId'];

/**
 * Nothing written. `''` counts: a required localized column is `NOT NULL DEFAULT ''`, and that is
 * what it holds when another field's write creates the locale's row.
 */
const unwritten = (value: unknown) => value === undefined || value === null || value === '';

/**
 * One row's worth of values out of the locales rows a read returned, taking each column from the
 * first row in `order` that holds a value.
 *
 * ```
 * order  ['fr', 'en']
 * rows   { locale: 'fr', title: 'Accueil', body: null }
 *        { locale: 'en', title: 'Home',    body: 'Welcome' }
 * →      { title: 'Accueil', body: 'Welcome' }
 * ```
 */
export const mergeLocaleRows = (rows: Dic[] | undefined, order: string[]): Dic => {
  const byLocale = new Map((rows ?? []).map((row) => [row.locale, row]));
  const ordered = order.map((code) => byLocale.get(code)).filter((row): row is Dic => !!row);
  const merged: Dic = {};

  for (const row of ordered) {
    for (const [key, value] of Object.entries(row)) {
      if (ROW_KEYS.includes(key)) continue;
      if (unwritten(merged[key])) merged[key] = value;
    }
  }

  return merged;
};
