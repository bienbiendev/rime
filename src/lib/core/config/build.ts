import { configureConfig } from './configure.js';
import type { BuiltArea, BuiltCollection, SanitizedConfigClient } from './types.js';
import { configurePlugins } from '#lib/core/plugins/configure.js';

/**
 * Both prototype lists exist, empty if the author named none, so nothing downstream guards them.
 */
export const withPrototypeLists = <
  T extends { collections?: BuiltCollection[]; areas?: BuiltArea[] }
>(
  config: T
): T & { collections: BuiltCollection[]; areas: BuiltArea[] } => ({
  ...config,
  collections: config.collections ?? [],
  areas: config.areas ?? []
});

/**
 * The client chain: steps 1 to 3 of `augmentConfig` in build.server.ts, without
 * `resolvePipelines`.
 */
export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withLists = withPrototypeLists(config);
  const configured = configureConfig(withLists);
  const output = configurePlugins(configured);
  return output;
};
