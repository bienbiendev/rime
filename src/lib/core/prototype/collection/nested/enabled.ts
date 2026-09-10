import type { Dic } from '$lib/util/types.js';

/**
 * A collection nests its documents by declaring `nested`.
 *
 * `Dic`, not a narrow shape: an area has no `nested` member at all, and every caller that guards
 * a step here holds one config or the other.
 */
export const isNested = (config: Dic): boolean => !!config.nested;
