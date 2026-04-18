import * as Area from '$lib/core/areas/config/builder.server.js';
import * as Collection from '$lib/core/collections/config/builder.server.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import type { BuiltConfigClient, SanitizedConfigClient } from '../types.js';
import { buildConfig } from './build-config.server.js';
export type { BuildConfig } from './build-config.server.js';

/** placeholder for types */
const rimeClient = (config: SanitizedConfigClient): BuiltConfigClient => {
  throw new Error("Don't use this function, this is a placeholder for types only");
  // @ts-expect-error this is a placeholder function
  return config;
};

export { Area, Collection, Hooks, buildConfig as rime, rimeClient };
