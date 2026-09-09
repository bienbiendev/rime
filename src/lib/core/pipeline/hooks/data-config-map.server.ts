import { buildConfigMap } from '../config-map/index.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';

export const buildDataConfigMap = Hooks.beforeUpsert({
  name: 'buildDataConfigMap',
  // `data-inspected` starts the shaping chain — `setDefaultValues` and `validateFields` follow
  // this through `config-map`, so declaring it once here holds all three back until every hook
  // that reads the caller's raw submission has run. Vacuous where nothing provides it.
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
