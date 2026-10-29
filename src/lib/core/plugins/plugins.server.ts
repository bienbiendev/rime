import type { Config } from '#lib/core/config/types.js';
import type { Handle } from '@sveltejs/kit/hooks';
import type { Rime } from '../rime.server.js';

/** Every plugin's `handler`, in the plugins' order, for the handle list of handler.server.ts. */
export function createPluginsHandler<const C extends Config>(rime: Rime<C>) {
  const pluginHandlers: Handle[] = [];

  for (const plugin of rime.config.raw.plugins || []) {
    if (plugin.handler) {
      pluginHandlers.push(plugin.handler);
    }
  }

  return pluginHandlers;
}
