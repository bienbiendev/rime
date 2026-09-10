import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { buildConfigMap } from '../config-map/index.js';

/**
 * Maps every path in the incoming data to the field builder that describes it, on
 * `context.configMap`.
 *
 * What `setDefaultValues` and `validateFields` walk, and what the write turns into
 * `incomingPaths` — the set of paths this request is allowed to touch.
 */
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
