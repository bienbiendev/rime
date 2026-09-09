import { configureWithFeatures } from '../features/registry.js';
import { area, collection } from '$lib/core/prototype/index.js';
import type { ApplyPrototypeConfigure } from '$lib/core/prototype/register.js';
import type { Dic } from '$lib/util/types.js';
import type { SanitizedConfigClient } from './types.js';
import { augmentPlugins } from './augment-plugins.js';

/**
 * Runs each prototype's whole-config `configure` — one line each, both of them the same line:
 * its own list exists, empty if the author named none, so nothing downstream has to guard it.
 *
 * The type side is declared in prototype/register.ts, because `configure` is typed `(any) => any`
 * on the definition and calling it directly would answer `any`.
 */
export const configureWithPrototypes = <T extends Dic>(
  config: T
): ApplyPrototypeConfigure<T, ['collection', 'area']> => {
  const withCollections = collection.configure ? collection.configure(config) : config;
  return (area.configure ? area.configure(withCollections) : withCollections) as never;
};

/** The client chain, same three layers as build.server.ts — see the note there. */
export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withPrototypes = configureWithPrototypes(config);
  const withFeatures = configureWithFeatures([collection, area], withPrototypes);
  const output = augmentPlugins(withFeatures);
  return output;
};
