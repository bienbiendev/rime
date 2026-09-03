import { buildConfigMap } from '../config-map/index.js';
import { Hooks } from '$lib/core/factory/hooks.js';

export const buildDataConfigMap = Hooks.beforeUpsert({
  name: 'buildDataConfigMap',
  requires: ['config-fields'],
  provides: ['config-map'],
  run: async (args) => {
    const configMap = buildConfigMap(args.data, args.config.fields);

    return {
      ...args,
      context: {
        ...args.context,
        configMap
      }
    };
  }
});
