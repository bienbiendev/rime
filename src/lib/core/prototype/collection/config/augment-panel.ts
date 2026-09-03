import type { CollectionPanelConfig, UploadConfig } from '$lib/core/config/types.js';

type Input = {
  panel?: CollectionPanelConfig;
  // `boolean | UploadConfig`, not the normalised shape. This only tests it for truthiness, so
  // requiring the normalised form was a hidden ordering dependency on upload's augment — one
  // that stopped holding the moment the prototype's own augments moved ahead of the features.
  upload?: boolean | UploadConfig;
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
