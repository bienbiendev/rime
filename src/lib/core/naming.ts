import type { CollectionSlug } from '$lib/types.js';

/**
 * Add a _directories suffix to a given name.
 * Used for uploads path slug and tables.
 * Prevent a version table name from being used, force the use of the main one.
 *
 * @example
 * // Returns both 'pages_directories'
 * withDirectoriesSuffix('pages');
 * withDirectoriesSuffix('pages_versions');
 */
export const withDirectoriesSuffix = (slug: string) =>
  `${slug.replace('_versions', '')}_directories` as CollectionSlug;

/**
 * Add a _versions suffix to a given name.
 * Used for document versioning slug and tables.
 *
 * @example
 * // Returns 'pages_versions'
 * withVersionsSuffix('pages');
 */
export const withVersionsSuffix = (name: string) => `${name}_versions` as CollectionSlug;

/**
 * Check if a slug is a verioned collection slug
 *  * @example
 * // Returns true
 * hasVersionsSuffix('pages_versions');
 *
 */
export const hasVersionsSuffix = (slug: string) => slug.endsWith('_versions');

/**
 * Check if a slug is a _directories collection slug
 *
 * @example
 * // Returns true
 * hasDirectoriesSuffix('medias_directories');
 */
export const hasDirectoriesSuffix = (slug: string) => slug.endsWith('_directories');

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
