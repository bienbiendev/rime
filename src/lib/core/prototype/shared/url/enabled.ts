import type { Dic } from '#lib/util/types.js';

/**
 * A config has a public URL by declaring `$url`.
 *
 * `Dic`, not a narrow shape: a caller holds either a collection or an area config.
 */
export const hasUrl = (config: Dic): boolean => !!config.$url;
