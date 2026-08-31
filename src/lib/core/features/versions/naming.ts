import type { CollectionSlug } from '$lib/types.js';

/**
 * The `_versions` slug and table-name convention.
 *
 * Lives with the feature that owns it rather than in a shared naming module: the adapter, the
 * panel and the operations layer all consume this vocabulary, none of them define it.
 */

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
 * Remove a _versions suffix from a given name.
 * Used for document versioning slug and tables.
 *
 * @example
 * // Returns 'pages'
 * withoutVersionsSuffix('pages_versions');
 */
export const withoutVersionsSuffix = (name: string) =>
  name.replace('_versions', '') as CollectionSlug;

/**
 * Check if a slug is a verioned collection slug
 *  * @example
 * // Returns true
 * hasVersionsSuffix('pages_versions');
 *
 */
export const hasVersionsSuffix = (slug: string) => slug.endsWith('_versions');
