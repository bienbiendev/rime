import type { Dic } from '$lib/util/types.js';

/**
 * A collection signs in by declaring `auth`.
 *
 * `Dic`, not a narrow shape: an area has no `auth` member at all, and every caller that guards
 * a step here holds one config or the other.
 */
export const isAuth = (config: Dic): boolean => !!config.auth;
