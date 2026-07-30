import type { CollectionPanelConfig } from '$lib/core/config/types';

type Input = {
  panel?: CollectionPanelConfig;
};
type WithPanel<T> = T & { panel: CollectionPanelConfig };

/**
 * Set panel to the defined one, or fallback to default
 */
export const augmentPanel = <T extends Input>(config: T): WithPanel<T> => {
  function addPanel(): CollectionPanelConfig {
    if (config.panel) {
      return config.panel;
    }
    return {
      dashboard: {
        maxEntries: 8,
        layout: 'rows'
      }
    };
  }

  return {
    ...config,
    panel: addPanel()
  };
};
