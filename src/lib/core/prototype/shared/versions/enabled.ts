import type { Dic } from '#lib/util/types.js';

/**
 * A config keeps history by declaring `versions`.
 *
 * `Dic`, not a narrow shape: a caller holds either a collection or an area config.
 */
export const isVersioned = (config: Dic): boolean => !!config.versions;

/** A config whose documents are the version rows of another — the derived `$<slug>__versions`. */
export const isVersionsCollection = (config: Dic): boolean => !!config._shadowOf;
