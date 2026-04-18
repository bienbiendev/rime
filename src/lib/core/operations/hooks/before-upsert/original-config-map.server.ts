import { RimeError } from '$lib/core/errors/index.js';
import { buildConfigMap } from '../../configMap/index.js';
import { Hooks } from '../index.server.js';

export const buildOriginalDocConfigMap = Hooks.beforeUpsert(async (args) => {
  const { originalDoc } = args.context;

  if (!originalDoc)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @buildDataConfigMap');

  const originalConfigMap = buildConfigMap(
    originalDoc,
    args.config.fields.map((f) => f.compile())
  );

  return {
    ...args,
    context: {
      ...args.context,
      originalConfigMap
    }
  };
});
