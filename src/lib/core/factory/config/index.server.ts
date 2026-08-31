import * as Area from '$lib/core/factory/area/index.server.js';
import * as Collection from '$lib/core/factory/collection/index.server.js';
import { Hooks } from '$lib/core/factory/hooks.js';
import type { BuiltConfigClient, SanitizedConfigClient } from './types.js';
import { buildConfig } from './build.server.js';
export type { BuildConfig } from './build.server.js';

/** placeholder for types */
const rimeClient = (config: SanitizedConfigClient): BuiltConfigClient => {
  throw new Error("Don't use this function, this is a placeholder for types only");
  // @ts-expect-error this is a placeholder function
  return config;
};

export { Area, Collection, Hooks, buildConfig as rime, rimeClient };
