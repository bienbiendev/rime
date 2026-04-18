import { type PluginClient, definePluginClient } from '../index.js';
import HeaderButton from './HeaderButton.svelte';

export const cacheClient = definePluginClient(() => {
  return {
    name: 'cache/client',
    type: 'client',
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
  } as const satisfies PluginClient;
});
