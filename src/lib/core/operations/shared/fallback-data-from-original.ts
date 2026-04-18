import { logger } from '$lib/core/logger/index.server.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '../configMap/types.js';

export const fallbackDataFromOriginal = async <T extends Dic>(args: {
  data: T;
  original: T;
  configMap: ConfigMap;
  ignore: string[];
}) => {
  //
  const { original, configMap, ignore } = args;
  let output = { ...args.data };

  for (const [key, config] of Object.entries(configMap)) {
    // skip keys in ignore list
    if (ignore.includes(key)) continue;

    let value = getValueAtPath(key, output);
    let isEmpty;

    try {
      isEmpty = config.isEmpty(value);
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
