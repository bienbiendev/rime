import type { Dic } from '$lib/util/types.js';

/**
 * A config keeps history by declaring `versions`.
 *
 * `Dic`, not a narrow shape: an area has no `versions` member at all, and every caller that guards
 * a step here holds one config or the other.
 */
export const isVersioned = (config: Dic): boolean => !!config.versions;
