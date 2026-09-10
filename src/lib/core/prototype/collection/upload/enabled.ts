import type { Dic } from '$lib/util/types.js';

/**
 * A collection stores files by declaring `upload`.
 *
 * `Dic`, not a narrow shape: an area has no `upload` member at all, and every caller that guards
 * a step here holds one config or the other.
 */
export const isUpload = (config: Dic): boolean => !!config.upload;
