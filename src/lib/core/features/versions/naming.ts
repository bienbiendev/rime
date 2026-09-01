import type { CollectionSlug } from '$lib/types.js';

/**
 * The versions shadow naming convention, in slug space.
 *
 * A derived slug is `$` + the base + `__` + the marker:
 *
 *   pages  ->  $pages__versions  ->  table pages__versions  ->  url pages--versions
 *
 * The `$` says rime made this, matching how `$hooks`/`$url`/`$adapter` already mark
 * rime-owned config keys. The `__` says *shadow of*, and it is a segment boundary rather than
 * a word break — which is why every case conversion goes through mapSegments and why an author
 * slug may not contain it (see factory/config/validate.server.ts). Without that rule a
 * collection named `pagesVersions` would snake-case onto the same table as this shadow.
 */

const DERIVED = '$';
const MARKER = '__versions';

/** `pages` -> `$pages__versions` */
export const withVersionsSuffix = (name: string) =>
  `${DERIVED}${name.replace(/^\$/, '')}${MARKER}` as CollectionSlug;

/** `$pages__versions` -> `pages`; anything else unchanged. */
export const withoutVersionsSuffix = (name: string) =>
  name.replace(/^\$/, '').replace(MARKER, '') as CollectionSlug;

/** `$pages__versions` -> true */
export const hasVersionsSuffix = (slug: string) => slug.endsWith(MARKER);
