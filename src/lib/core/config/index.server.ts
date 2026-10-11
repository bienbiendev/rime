import * as Area from '#lib/core/prototype/area/index.js';
import * as Collection from '#lib/core/prototype/collection/index.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import type { BuiltConfigClient, SanitizedConfigClient } from './types.js';
import { buildConfig } from './build.server.js';
export type { BuildConfig } from './build.server.js';

/**
 * Types only. `$rime/config` is typed as `rimecms/config/server`, so the sanitized client config's
 * `rimeClient(...)` call needs a name here. The client build runs `rimecms/config`'s
 * `buildConfigClient` instead.
 */
const rimeClient = (config: SanitizedConfigClient): BuiltConfigClient => {
  throw new Error("Don't use this function, this is a placeholder for types only");
  // @ts-expect-error this is a placeholder function
  return config;
};

export { Area, Collection, Hooks, buildConfig as rime, rimeClient };
