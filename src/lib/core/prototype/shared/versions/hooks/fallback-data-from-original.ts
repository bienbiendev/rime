import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '$lib/core/pipeline/config-map/types.js';

/**
 * A new version holds the whole document: each field the update did not send takes the previous
 * version's value. A field sent empty stays empty, so a field cleared on purpose stays cleared.
 *
 * ```ts
 * // previous version: { title: 'A', intro: 'B' }
 * fallbackDataFromOriginal({ data: { title: 'C' }, … })               // { title: 'C', intro: 'B' }
 * fallbackDataFromOriginal({ data: { title: 'C', intro: null }, … })  // { title: 'C', intro: null }
 * ```
 *
 * A list sent — blocks, tree items, relations — is the update's as sent: nothing is taken into it
 * from the previous version's list.
 */
export const fallbackDataFromOriginal = <T extends Dic>(args: {
  data: T;
  original: T;
  configMap: ConfigMap;
  ignore: string[];
}): T => {
  const { original, configMap, ignore } = args;
  let output: Dic = { ...args.data };

  for (const key of Object.keys(configMap)) {
    if (ignore.includes(key)) continue;
    if (getValueAtPath(key, output) !== undefined) continue;
    if (insideSentList(key, output)) continue;
    output = setValueAtPath(key, output, getValueAtPath(key, original));
  }

  return output as T;
};

/** `sections.0.title` is inside a sent list when `sections` is an array in the data. */
const insideSentList = (key: string, data: Dic) => {
  const parts = key.split('.');
  for (let length = 1; length < parts.length; length++) {
    if (Array.isArray(getValueAtPath(parts.slice(0, length).join('.'), data))) return true;
  }
  return false;
};
