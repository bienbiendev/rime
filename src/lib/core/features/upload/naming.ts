import type { CollectionSlug } from '$lib/types.js';
import { withoutVersionsSuffix } from '../versions/naming.js';

/**
 * The upload directories naming convention, in slug space.
 *
 *   medias  ->  $mediasDirectories  ->  table medias_directories  ->  url medias-directories
 *
 * `$` marks it rime-derived, but there is deliberately **no `__`**: a directories collection is
 * a sibling, not a shadow or a child, and holds no schema relationship to its parent. So its
 * table name carries no relationship marker and stays exactly what it is today. Telling a
 * directories collection apart is the upload feature's job — by this convention — not something
 * the table name can answer.
 *
 * The versions suffix comes off first, and that dependency is real: a folder tree belongs to
 * the document, not to a revision of it.
 */

const DERIVED = '$';
const MARKER = 'Directories';

/** `medias` or `$medias__versions` -> `$mediasDirectories` */
export const withDirectoriesSuffix = (slug: string) =>
  `${DERIVED}${withoutVersionsSuffix(slug)}${MARKER}` as CollectionSlug;

/** `$mediasDirectories` -> `medias` */
export const withoutDirectoriesSuffix = (slug: string) =>
  slug.replace(/^\$/, '').replace(new RegExp(`${MARKER}$`), '') as CollectionSlug;

/** `$mediasDirectories` -> true */
export const hasDirectoriesSuffix = (slug: string) => slug.endsWith(MARKER);
