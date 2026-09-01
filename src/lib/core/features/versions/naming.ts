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

/**
 * The slug that owns a prototype's content — its shadow when versioned, itself when not.
 *
 * `owner = shadow ?? base`, the load-bearing line in docs/decoupling-adapter.md: enabling
 * versions moves a whole subtree of children (blocks, tree, relations) onto the shadow. Every
 * caller that writes children needs it, and each was spelling the ternary out and then asking
 * the adapter to turn it into a table name — which put table names in core's hands. Core stays
 * in slug space; the adapter maps.
 */
export const contentOwnerSlug = (config: { slug: string; versions?: unknown }) =>
  (config.versions ? withVersionsSuffix(config.slug) : config.slug) as CollectionSlug;
