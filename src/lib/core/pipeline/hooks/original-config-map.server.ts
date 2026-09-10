import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { RimeError } from '$lib/core/errors/index.js';
import { buildConfigMap } from '../config-map/index.js';

/**
 * The same map as `buildDataConfigMap`, over the document as it is now rather than as it is being
 * sent — on `context.originalConfigMap`.
 *
 * What a step comparing the two needs: `prepareDataForNewVersion` reads it to carry forward a
 * field the caller did not send.
 */
export const buildOriginalDocConfigMap = Hooks.beforeUpsert(
  async function buildOriginalDocConfigMap(args) {
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
);
