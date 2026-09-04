import { configureWithFeatures } from '../features/registry.js';
import { configureWithPrototypes, prototypes } from '$lib/core/prototype/registry.js';
import type { SanitizedConfigClient } from './types.js';
import { augmentPlugins } from './augment-plugins.js';

/** The client chain, same three layers as build.server.ts — see the note there. */
export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withPrototypes = configureWithPrototypes(config);
  const withFeatures = configureWithFeatures(prototypes, withPrototypes);
  const output = augmentPlugins(withFeatures);
  return output;
};
