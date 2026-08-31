import { augmentIcons } from './augment-icons.js';
import type { SanitizedConfigClient } from './types.js';
import { uploadClient } from '../../features/upload/index.js';
import { augmentPanel } from './augment-panel.js';
import { augmentPlugins } from './augment-plugins.js';
import { augmentStaff } from '../../features/auth/staff/augment.js';

export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
  const withStaff = augmentStaff(config);
  const withIcons = augmentIcons(withStaff);
  const withPanel = augmentPanel(withIcons);
  const withDirectories = uploadClient.derive.client(withPanel);
  const output = augmentPlugins(withDirectories);
  return output;
};
