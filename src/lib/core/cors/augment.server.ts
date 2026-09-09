import type { Config } from '$lib/core/config/types.js';
import { hasProp } from '$lib/util/object.js';

/**
 * Which origins may call the API, defaulted to the app's own URL.
 *
 * A whole-config step, so the feature declares it as `configure`. What it does to the type is
 * declared in index.ts — `$trustedOrigins` is optional as an author writes it, and the handler
 * beside this file reads it as a list that is always there.
 */
export const augmentCORS = <const T extends Config>(config: T) => {
  const trustedOrigins =
    hasProp('$trustedOrigins', config) && Array.isArray(config.$trustedOrigins)
      ? config.$trustedOrigins
      : [process.env.PUBLIC_RIME_URL as string];

  return { ...config, $trustedOrigins: trustedOrigins } as const;
};
