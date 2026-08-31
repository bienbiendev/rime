/**
 * The localized-table naming convention.
 *
 * Document localization is *not* a feature by rime's own test: `pipeline.server.ts` never
 * branches on it, every table gets this treatment, and `setDocumentLocale` runs
 * unconditionally. It is always-on infrastructure, so it sits here rather than under
 * `features/`.
 *
 * It is here and not in `adapter-sqlite/` — today's only caller — so that a second adapter
 * builds localized table names from the same source rather than restating the convention.
 */

/**
 * Add a i18n suffix to a given name.
 * Used for localized tables name
 *
 * @example
 * // Returns 'pagesLocales'
 * withLocalesSuffix('pages');
 * // Returns 'pages_versionsLocales'
 * withLocalesSuffix('pages_versions');
 */
export const withLocalesSuffix = (name: string) => `${name}Locales`;
