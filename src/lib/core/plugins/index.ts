import type { Config, RouteConfig } from '#lib/types.js';
import type { Handle } from '@sveltejs/kit/hooks';
import type { SanitizedConfigClient } from '../config/types.js';

type MaybeAsyncFunction = (...args: any[]) => any | Promise<any>;

export type Plugin = {
  name: string;
  // One step, both sides: configure.ts runs this over a full Config on the server and a
  // SanitizedConfigClient on the client, so the same function has to satisfy both.
  configure?: <const C extends Config | SanitizedConfigClient>(config: C) => C;
  actions?: Record<string, MaybeAsyncFunction>;
  routes?: Record<string, RouteConfig>;
  handler?: Handle;
};

export function definePlugin<const F extends (options?: any) => Plugin>(factory: F): F {
  return factory;
}
