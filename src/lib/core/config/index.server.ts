// @decouple prototype definition, area and collections should not be named here
// ex:
// create a barrel from prototypes that export all prototypes
// the export * from prototypes  
import * as Area from '$lib/core/prototype/area/index.js';
import * as Collection from '$lib/core/prototype/collection/index.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';
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
