import type { Config, RouteConfig } from '$lib/types.js';
import type { Handle } from '@sveltejs/kit';
import type { SanitizedConfigClient } from '../factory/config/types.js';

type MaybeAsyncFunction = (...args: any[]) => any | Promise<any>;

export type Plugin = {
  name: string;
  // One step, both sides: augment-plugins.ts runs this over a full Config on the server and a
  // SanitizedConfigClient on the client, so the same function has to satisfy both — as it must
  // anyway now that there is one Plugin type instead of a Plugin/PluginClient pair.
  configure?: <const C extends Config | SanitizedConfigClient>(config: C) => C;
  actions?: Record<string, MaybeAsyncFunction>;
  routes?: Record<string, RouteConfig>;
  handler?: Handle;
};

export function definePlugin<const F extends (options?: any) => Plugin>(factory: F): F {
  return factory;
}
