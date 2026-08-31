import type { CollectionSlug } from '$lib/types.js';

/**
 * The `_directories` slug and table-name convention for upload collections.
 *
 * Lives with the feature that owns it rather than in a shared naming module: the adapter and
 * the panel consume this vocabulary, they do not define it.
 */

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
 * Remove a _directories suffix to a given name.
 * Used for uploads path slug and tables.
 * Prevent a version table name from being used, force the use of the main one.
 *
 * @example
 * // Returns 'pages'
 * withoutDirectoriesSuffix('pages_directories');
 * withoutDirectoriesSuffix('pages_versions_directories');
 */
export const withoutDirectoriesSuffix = (slug: string) =>
  slug.replace('_directories', '') as CollectionSlug;

/**
 * Check if a slug is a _directories collection slug
 *
 * @example
 * // Returns true
 * hasDirectoriesSuffix('medias_directories');
 */
export const hasDirectoriesSuffix = (slug: string) => slug.endsWith('_directories');
