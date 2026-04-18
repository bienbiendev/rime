import type { Config } from '$lib/core/config/types.js';
import { type Handle } from '@sveltejs/kit';
import type { Rime } from '../rime.server.js';

export function createPluginsHandler<const C extends Config>(rime: Rime<C>) {
  const pluginHandlers: Handle[] = [];

  for (const plugin of rime.config.raw.$plugins || []) {
    if (plugin.handler) {
      pluginHandlers.push(plugin.handler);
    }
  }

  return pluginHandlers;
}
