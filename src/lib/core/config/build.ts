import { configureConfig } from './configure.js';
import type { BuiltArea, BuiltCollection, SanitizedConfigClient } from './types.js';
import { configurePlugins } from '$lib/core/plugins/configure.js';

/**
 * Both prototype lists exist, empty if the author named none, so nothing downstream guards them.
 *
 * Was two `configure` props on the definitions, folded by `configureWithPrototypes`, with the
 * result's *type* declared through a `PrototypeConfigure` merging target and replayed by a
 * recursive `ApplyPrototypeConfigure`. Three mechanisms for two `?? []`, and the type they
 * produced is the one an object literal infers on its own.
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

/** The client chain, same three layers as build.server.ts — see the note there. */
export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withPrototypes = withPrototypeLists(config);
  const withFeatures = configureConfig(withPrototypes);
  const output = configurePlugins(withFeatures);
  return output;
};
