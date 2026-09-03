import { configureWithFeatures } from '../../features/registry.js';
import { configureWithPrototypes, prototypes } from '$lib/core/prototype/registry.js';
import { augmentIcons } from '../../features/panel/icons.js';
import type { SanitizedConfigClient } from './types.js';
import { augmentPanel } from '../../features/panel/augment.js';
import { augmentPlugins } from './augment-plugins.js';
import { augmentStaff } from '../../features/auth/staff/augment.js';

export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withStaff = augmentStaff(config);
  const withPrototypes = configureWithPrototypes(withStaff);
  const withIcons = augmentIcons(withPrototypes);
  const withPanel = augmentPanel(withIcons);
  const withFeatures = configureWithFeatures(prototypes, withPanel);
  const output = augmentPlugins(withFeatures);
  return output;
};
