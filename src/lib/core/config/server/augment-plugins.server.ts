import { dev } from '$app/environment';
import type { Config } from '$lib/core/config/types.js';
import { apiInit } from '$lib/core/plugins/api-init/index.js';
import { cache } from '$lib/core/plugins/cache/index.js';
import type { Plugin } from '$lib/core/plugins/index.js';
import { mailer } from '$lib/core/plugins/mailer/index.js';
import { sse } from '$lib/core/plugins/sse/index.js';

export const augmentPluginsServer = <const T extends Config>(config: T) => {
  //
  const corePluginsServer = [
    // Server Sent Event
    sse(),
    // Cache plugin with default isEnabled : event => !event.locals.user
    cache(config.$cache || {}),
    // Add init plugins in dev mode
    ...(dev ? [apiInit()] : []),
    // Mailer plugin
    ...(config.$smtp ? [mailer(config.$smtp)] : [])
  ];

  // Widened to Plugin[] on purpose: each factory's own `as const satisfies Plugin` return
  // keeps a precise literal shape (no `handler` key at all on sse's, no `actions` on
  // apiInit's, ...) — left as a tuple, downstream code reading `.handler`/`.actions` off
  // the union fails to typecheck even though both are optional on Plugin. Doesn't affect
  // build-config.server.ts's ExtractCustomPlugins/InferCorePlugins, which infer off the
  // pre-augmentation config type, not this array.
  const plugins: Plugin[] = [...corePluginsServer, ...(config.plugins || [])];

  let configWithPlugins = config;
  for (const plugin of plugins) {
    if ('configure' in plugin && typeof plugin.configure === 'function') {
      configWithPlugins = plugin.configure(configWithPlugins);
    }

    // Register routes
    if ('routes' in plugin && typeof plugin.routes === 'object') {
      configWithPlugins = {
        ...configWithPlugins,
        $routes: {
          ...(configWithPlugins.$routes || {}),
          ...plugin.routes
        }
      };
    }
  }

  return {
    ...configWithPlugins,
    $plugins: plugins
  } as const;
};
