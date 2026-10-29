import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { buildConfigMap } from '../config-map/index.js';

/**
 * The same map as `buildDataConfigMap`, over the document as it is now rather than as it is being
 * sent — on `context.originalConfigMap`.
 *
 * Read where a save compares with what is stored: `prepareDataForNewVersion` to carry forward a
 * field the caller did not send, `validateFields` to check the document the update leaves, and
 * `saveBlocks` and `saveTreeBlocks` for the rows a save replaces.
 */
export const buildOriginalDocConfigMap = Hooks.beforeUpsert(
  async function buildOriginalDocConfigMap(args) {
    const { originalDoc } = args.context;

    if (!originalDoc)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @buildOriginalDocConfigMap'
      );

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
