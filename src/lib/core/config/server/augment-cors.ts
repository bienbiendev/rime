import type { Config } from '$lib/core/config/types.js';
import { hasProp } from '$lib/util/object.js';

export const augmentCORS = <const T extends Config>(config: T) => {
  const trustedOrigins =
    hasProp('$trustedOrigins', config) && Array.isArray(config.$trustedOrigins)
      ? config.$trustedOrigins
      : [process.env.PUBLIC_RIME_URL as string];

  return { ...config, $trustedOrigins: trustedOrigins } as const;
};
