import { cache } from '$lib/core/plugins/cache/index.js';
import type { SanitizedConfigClient } from '../types.js';

export const augmentPlugins = <const T extends SanitizedConfigClient>(config: T) => {
  const plugins = [cache(), ...(config.plugins || [])];

  for (const plugin of plugins) {
    if ('configure' in plugin && typeof plugin.configure === 'function') {
      config = plugin.configure(config);
    }
  }

  return {
    ...config,
    plugins
  } as const;
};
