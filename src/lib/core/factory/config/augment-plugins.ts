import { defaultPlugins } from '$lib/core/plugins/defaults/index.js';
import type { PluginHost } from '$lib/core/plugins/defaults/types.js';
import type { Plugin } from '$lib/core/plugins/index.js';

/**
 * The plugin step, once, for both sides.
 *
 * There used to be two: `augmentPlugins` (client) and `augmentPluginsServer`, differing only in
 * which core plugins they prepend and in the server one also collecting `plugin.routes`. That
 * split predates plugins being isomorphic — the core list is a `$rime/modules` pair now
 * (`plugins/defaults/`), so one function serves both builds and each gets its own list.
 *
 * `build.server.ts` called **both**, which was not two steps but one step twice: `cache()` landed
 * in the list a second time and every `configure` ran again, so the panel header carried three
 * copies of the clear-cache button. Running once is the fix, and the position kept is the second
 * one — last in the chain, after the features have derived what they derive — so a plugin's
 * `configure` sees the config the rest of rime will see.
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
