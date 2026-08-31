import { RimeError } from '$lib/core/errors/index.js';
import { buildConfigMap } from '../config-map/index.js';
import { Hooks } from '$lib/core/factory/hooks.js';

export const buildOriginalDocConfigMap = Hooks.beforeUpsert(async (args) => {
  const { originalDoc } = args.context;

  if (!originalDoc)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @buildDataConfigMap');

  const originalConfigMap = buildConfigMap(originalDoc, args.config.fields);

  return {
    ...args,
    context: {
      ...args.context,
      originalConfigMap
    }
  };
});
