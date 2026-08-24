import { definePlugin, type Plugin } from '../index.js';
import HeaderButton from './HeaderButton.svelte';

// Signature has to match module.server.ts's — the same call site (whatever the consumer
// wrote in rime.config.ts) compiles against both, whichever one this build resolves to.
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
