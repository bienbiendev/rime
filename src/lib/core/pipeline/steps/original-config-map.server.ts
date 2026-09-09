import { HOOK_MARKS } from '$lib/core/pipeline/marks.js';
import { RimeError } from '$lib/core/errors/index.js';
import { buildConfigMap } from '../config-map/index.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

export const buildOriginalDocConfigMap = Hooks.beforeUpsert({
  name: 'buildOriginalDocConfigMap',
  requires: [HOOK_MARKS.ORIGINAL_DOC],
  provides: [HOOK_MARKS.ORIGINAL_CONFIG_MAP],
  run: async (args) => {
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
  }
});
