import { logger } from '$lib/core/logger/index.server.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '../configMap/types.js';

export const fallbackDataFromOriginal = async <T extends Dic>(args: {
  data: T;
  original: T;
  configMap: ConfigMap;
  ignore: string[];
  mode?: 'required' | 'all';
}) => {
  //
  const mode = args.mode || 'all';
  const { original, configMap, ignore } = args;
  let output = { ...args.data };

  for (const [key, config] of Object.entries(configMap)) {
    // skip keys in ignore list
    if (ignore.includes(key)) continue;

    // skip if not required and mode is 'required'
    const shouldUpdate = (config.get.required && mode === 'required') || mode === 'all';
    if (!shouldUpdate) continue;

    let value = getValueAtPath(key, output);
    let isEmpty;

    try {
      isEmpty = config.use.isEmpty(value);
    } catch {
      isEmpty = false;
      logger.warn(`Error while checking if field ${key} is empty`);
    }

    if (isEmpty) {
      value = await getValueAtPath(key, original);
      output = setValueAtPath(key, output, value);
    }
  }

  return output;
};
