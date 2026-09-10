import type { Dic } from '$lib/util/types.js';
import { flatten } from 'flat';
import cache from '../dev/cache.server.js';
import { CONFIG_DIR } from '../dev/constants.server.js';

/**
 * We actually need to serialize config values that will trigger
 * types, routes, or schema generations, meaning that for now
 * a basic serialization approach is sufficient.
 */
const serializeValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'function':
      // Handle functions
      if (Object.prototype.hasOwnProperty.call(value, 'render')) {
        return `func:${value.name}`;
      }
      return `func:${value.toString()}`;

    case 'object':
      try {
        // Builder instances (fields, tabs, blocks, ...) may hold their real state behind
        // private class fields (e.g. TabBuilder's #tab), invisible to Object.keys()/
        // JSON.stringify() — flatten() then treats them as leaf objects with zero own keys,
        // silently serializing as `{}` regardless of actual content. compile() is the same
        // method already calls to get a plain, fully-resolved representation, so
        // reuse it here instead of reflecting blindly.
        if (typeof value.compile === 'function') {
          return serializeValue(value.compile());
        }
        if (Array.isArray(value)) {
          return `array:${JSON.stringify(value)}`;
        }
        // Handle Date objects
        if (value instanceof Date) {
          return `date:${value.toISOString()}`;
        }
        // Handle regular objects
        return `object:${JSON.stringify(value)}`;
      } catch (err: any) {
        return `error:${err.message}`;
      }

    default:
      // Handle primitive values
      return `${typeof value}:${value}`;
  }
};

const writeMemo = <T extends object>(config: T) => {
  const memo: Dic = flatten(config);
  // const memoStr = JSON.stringify(config);
  const memoStr = Object.entries(memo)
    .map(([key, value]) => {
      try {
        const serializedValue = serializeValue(value);
        return `${key}:${serializedValue}`;
      } catch (err: any) {
        throw new Error(`Config error : Unable to parse value for key ${key}: ${err.message}`);
      }
    })
    // Not part of the user's config object, but generated output (routes, schema, hooks) is
    // relative to it — a RIME_CONFIG_DIR change must invalidate the memo just like a config
    // change does, even when the config content itself is byte-identical.
    .concat(`CONFIG_DIR:${CONFIG_DIR}`)
    .join('\n');

  const cached = cache.get('config');

  if (cached !== memoStr) {
    cache.set('config', memoStr);

    return true;
  } else {
    return false;
  }
};

export default writeMemo;
