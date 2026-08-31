import type { CollectionSlug } from '$lib/types.js';
import { withoutVersionsSuffix } from '../versions/naming.js';

/**
 * The `_directories` slug and table-name convention for upload collections.
 *
 * Lives with the feature that owns it rather than in a shared naming module: the adapter and
 * the panel consume this vocabulary, they do not define it.
 *
 * The one cross-feature dependency here is deliberate and now explicit: a directories table
 * belongs to the document, not to a revision of it, so the versions suffix has to come off
 * first. That used to be a hardcoded `.replace('_versions', '')` — upload restating another
 * feature's convention as a magic string, which would silently produce
 * `medias_versions_directories` the day versions changed its suffix. It asks versions now.
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
  `${withoutVersionsSuffix(slug)}_directories` as CollectionSlug;

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
