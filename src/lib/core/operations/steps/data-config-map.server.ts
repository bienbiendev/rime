import { buildConfigMap } from '../config-map/index.js';
import { Hooks } from '$lib/core/operations/hooks.js';

export const buildDataConfigMap = Hooks.beforeUpsert(async (args) => {
  const configMap = buildConfigMap(args.data, args.config.fields);

  return {
    ...args,
    context: {
      ...args.context,
      configMap
    }
  };
});
