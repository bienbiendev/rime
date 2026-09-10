import type { Dic } from '$lib/util/types.js';

/**
 * A config has a public URL by declaring `$url`.
 *
 * `Dic`, not a narrow shape: an area has no `$url` member at all, and every caller that guards
 * a step here holds one config or the other.
 */
export const hasUrl = (config: Dic): boolean => !!config.$url;
