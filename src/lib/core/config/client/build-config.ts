import { augmentIcons } from '../shared/augment-icons.js';
import type { SanitizedConfigClient } from '../types.js';
import { augmentDirectories } from './augment-directories.js';
import { augmentPanel } from './augment-panel.js';
import { augmentPlugins } from './augment-plugins.js';
import { augmentStaff } from './augment-staff.js';

export const buildConfigClient = <C extends SanitizedConfigClient>(config: C) => {
	const withStaff = augmentStaff(config);
	const withIcons = augmentIcons(withStaff);
	const withPanel = augmentPanel(withIcons);
	const withDirectories = augmentDirectories(withPanel);
	const output = augmentPlugins(withDirectories);
	return output;
};
