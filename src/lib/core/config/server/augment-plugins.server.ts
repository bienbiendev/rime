import { dev } from '$app/environment';
import type { Config } from '$lib/core/config/types.js';
import { apiInit } from '$lib/core/plugins/api-init/index.server.js';
import { cache } from '$lib/core/plugins/cache/index.server.js';
import { mailer } from '$lib/core/plugins/mailer/index.server.js';
import { sse } from '$lib/core/plugins/sse/index.server.js';

// export type WithPluginsServer<T> = T & { $plugins: ReturnType<Plugin>[] };

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
  ] as const;

  const plugins = [...corePluginsServer, ...(config.$plugins || [])] as const;

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
