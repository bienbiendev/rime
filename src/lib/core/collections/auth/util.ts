import type { CollectionAuthConfig } from '$lib/core/config/types.js';

/**
 * Checks if a collection configuration has authentication capabilities
 * @example
 * if (isAuthConfig(collection)) {
 *   // Handle auth-specific functionality
 * }
 */
export const isAuthConfig = <T extends { auth?: boolean | CollectionAuthConfig }>(
  config: T
): config is T & { auth: true | CollectionAuthConfig } => !!config.auth;
