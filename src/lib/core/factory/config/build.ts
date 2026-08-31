import { augmentIcons } from './augment-icons.js';
import type { SanitizedConfigClient } from './types.js';
import { augmentDirectories } from '../../features/upload/directories.js';
import { augmentPanel } from './augment-panel.js';
import { augmentPlugins } from './augment-plugins.js';
import { augmentStaff } from '../../features/auth/staff/augment.js';

export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withStaff = augmentStaff(config);
  const withIcons = augmentIcons(withStaff);
  const withPanel = augmentPanel(withIcons);
  const withDirectories = augmentDirectories(withPanel);
  const output = augmentPlugins(withDirectories);
  return output;
};
