import { buildConfigMap } from '../../configMap/index.js';
import { Hooks } from '../index.server.js';

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
