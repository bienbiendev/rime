import type { CollectionPanelConfig, UploadConfig } from '$lib/core/config/types.js';

type Input = {
  panel?: CollectionPanelConfig;
  upload?: UploadConfig;
};
type WithPanel<T> = T & { panel: CollectionPanelConfig };

/**
 * Set panel to the defined one, or fallback to default
 */
export const augmentPanel = <T extends Input>(config: T): WithPanel<T> => {
  function addPanel(): CollectionPanelConfig {
    return {
      ...(config.panel || {}),
      dashboard: {
        maxEntries: 8,
        layout: config.upload ? 'grid' : 'rows',
        ...(config.panel && config.panel.dashboard ? config.panel.dashboard : {})
      }
    };
  }

  return {
    ...config,
    panel: addPanel()
  };
};
