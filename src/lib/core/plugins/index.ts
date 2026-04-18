import type { Config, RouteConfig } from '$lib/types.js';
import type { Handle } from '@sveltejs/kit';
import type { SanitizedConfigClient } from '../config/types.js';

type MaybeAsyncFunction = (...args: any[]) => any | Promise<any>;

export type PluginClient = {
  name: string;
  type: 'client';
  configure?: <const C extends SanitizedConfigClient>(config: C) => C;
};

export type Plugin = {
  name: string;
  type: 'server';
  configure?: <const C extends Config>(config: C) => C;
  actions?: Record<string, MaybeAsyncFunction>;
  routes?: Record<string, RouteConfig>;
  handler?: Handle;
};

export function definePlugin<const F extends (options?: any) => Plugin>(factory: F): F {
  return factory;
}

export function definePluginClient<const F extends (options?: any) => PluginClient>(factory: F): F {
  return factory;
}
