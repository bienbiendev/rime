import { defaultPlugins } from '$lib/core/plugins/defaults/index.js';
import type { PluginHost } from '$lib/core/plugins/defaults/types.js';
import type { Plugin } from '$lib/core/plugins/index.js';

/**
 * The plugin step, once, for both sides.
 *
 * Each build gets its own core plugins from `plugins/defaults/`, a `$rime/modules` pair, so one
 * function serves both. Last in the config chain, after the features have derived what they
 * derive, so a plugin's `configure` sees the config the rest of rime will see.
 */
export const augmentPlugins = <const T extends PluginHost>(config: T) => {
  const plugins: Plugin[] = [...defaultPlugins(config), ...(config.plugins || [])];

  let output = config;
  for (const plugin of plugins) {
    if (typeof plugin.configure === 'function') {
      output = plugin.configure(output);
    }

    // Register routes. Client-side this is a no-op — no client half declares any — but the
    // branch is the plugin contract, not a server detail, so it lives with the loop.
    if (typeof plugin.routes === 'object') {
      output = {
        ...output,
        $routes: { ...(output.$routes || {}), ...plugin.routes }
      };
    }
  }

  return { ...output, plugins } as const;
};
