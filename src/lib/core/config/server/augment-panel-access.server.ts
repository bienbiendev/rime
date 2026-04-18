import type { PanelConfig } from '$lib/core/config/types.js';
import type { User } from '$lib/types.js';
import { access } from '$lib/util/index.js';

export const augmentPanelAccess = <const T extends { panel: PanelConfig }>(config: T) => {
  const panel = {
    ...config.panel,
    $access: config.panel?.$access ? config.panel.$access : (user?: User) => access.isAdmin(user)
  };

  return { ...config, panel } as const;
};
