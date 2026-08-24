import type { Config, RouteConfig } from '$lib/types.js';
import type { Handle } from '@sveltejs/kit';
import type { SanitizedConfigClient } from '../config/types.js';

type MaybeAsyncFunction = (...args: any[]) => any | Promise<any>;

export type Plugin = {
  name: string;
  // Runs from both augment-plugins.server.ts (full Config) and augment-plugins.ts
  // (SanitizedConfigClient) — same function has to satisfy both call sites now that
  // there's one Plugin type instead of a separate Plugin/PluginClient pair.
  configure?: <const C extends Config | SanitizedConfigClient>(config: C) => C;
  actions?: Record<string, MaybeAsyncFunction>;
  routes?: Record<string, RouteConfig>;
  handler?: Handle;
};

export function definePlugin<const F extends (options?: any) => Plugin>(factory: F): F {
  return factory;
}
