import { definePlugin, type Plugin } from '../index.js';
import HeaderButton from './HeaderButton.svelte';

// Call sites are typed against module.server.ts's `(options?) => Plugin`; this half takes no
// options and ignores any passed.
export const cache = definePlugin(() => {
  return {
    name: 'cache',
    configure: (config) => {
      config = {
        ...config,
        panel: {
          ...(config.panel || {}),
          components: {
            ...(config.panel?.components || { header: [], collectionHeader: [] }),
            header: [...(config.panel?.components?.header || []), HeaderButton]
          }
        }
      };
      return config;
    }
  } as const satisfies Plugin;
});
