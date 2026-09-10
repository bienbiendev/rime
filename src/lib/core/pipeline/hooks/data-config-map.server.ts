import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { buildConfigMap } from '../config-map/index.js';

export const buildDataConfigMap = Hooks.beforeUpsert(async function buildDataConfigMap(args) {
  const configMap = buildConfigMap(args.data, args.config.fields);

  return {
    ...args,
    context: {
      ...args.context,
      configMap
    }
  };
});
