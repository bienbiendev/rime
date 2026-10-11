import { SITE_URL } from '$app/env/public';
import type { Config } from '#lib/core/config/types.js';

/**
 * Which origins may call the API: the site's own, which the panel's fetches send, and the ones
 * `$trustedOrigins` adds. Each is an origin as a browser sends it, `https://app.example.com`,
 * with no path or trailing slash.
 *
 * A whole-config step, so the feature declares it as `configure`. `$trustedOrigins` is optional
 * as an author writes it; `BuiltConfig.$trustedOrigins` (core/config/types.ts) is always a list,
 * and the handler beside this file reads it.
 */
export const configureCors = <const T extends Config>(config: T) => {
  const authored = Array.isArray(config.$trustedOrigins) ? config.$trustedOrigins : [];
  const trustedOrigins = [...new Set([new URL(SITE_URL).origin, ...authored])];
  return { ...config, $trustedOrigins: trustedOrigins } as const;
};
