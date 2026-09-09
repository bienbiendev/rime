import type { CollectionSlug } from '$lib/types.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';

/**
 * The upload directories naming convention, in slug space.
 *
 *   medias  ->  $mediasDirectories  ->  table medias_directories  ->  url medias-directories
 *
 * `$` marks it rime-derived, but there is deliberately **no `__`**: a directories collection is
 * a sibling, not a versions or a child, and holds no schema relationship to its parent. So its
 * table name carries no relationship marker and stays exactly what it is today. Telling a
 * directories collection apart is the upload feature's job — by this convention — not something
 * the table name can answer.
 *
 * A folder tree belongs to the **document**, not to a revision of it, so a versions's directories
 * are its owner's. That used to be spelled `withoutVersionsSuffix(slug)` here — this feature
 * stripping another feature's suffix, and the only feature-to-feature import in the whole
 * registry. `directoriesOf` below asks the config whose it is instead, and a second feature
 * declaring a versions works with no change.
 */

const DERIVED = '$';
const MARKER = 'Directories';

/** `medias` -> `$mediasDirectories`. A slug in, a slug out; it strips nothing. */
export const withDirectoriesSuffix = (slug: string) =>
  `${DERIVED}${slug}${MARKER}` as CollectionSlug;

/**
 * The directories collection a config's files live under — its own, or its owner's when it is a
 * versions.
 *
 * The one call site that has a config rather than a bare slug should use this. `_shadowOf` is
 * core's answer to "whose content is this", set by whichever feature derived the versions.
 */
export const directoriesOf = (config: { slug: string; _shadowOf?: string }) =>
  withDirectoriesSuffix(config._shadowOf ?? config.slug);

/**
 * The URL form of a collection's directories sibling: `medias` -> `medias-directories`.
 *
 * Takes the **slug**, never the kebab. Three panel call sites did
 * `apiUrl(withDirectoriesSuffix(config.kebab))`, which was right only while a slug and its
 * kebab were the same string — it now builds `/api/$mediasDirectories`, and for a multi-word
 * collection it corrupts the name twice over (`my-medias` -> `$my-mediasDirectories`).
 */
export const directoriesKebab = (slug: string) => prototypeKebab(withDirectoriesSuffix(slug));
