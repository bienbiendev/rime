import type { Dic } from '$lib/util/types.js';
import { flatten } from 'flat';
import cache from './cache.server.js';
import { CONFIG_DIR } from './constants.server.js';
import { restSurface } from './prototype-routes.server.js';
import { rimeVersion } from './version.server.js';

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
    // Nor is rime's own version, and generated output belongs to it as much as to the config:
    // routes, the drizzle schema and app.generated.d.ts are all written from templates that ship
    // with the package. Without this an upgrade that changes one of them regenerates nothing for
    // a project whose config did not also change, and the new code runs against the old files —
    // a panel calling a form action the generated route never exported, and no error saying so.
    .concat(`RIME_VERSION:${rimeVersion()}`)
    // Nor are the /api routes the prototypes declare. This gate runs before every codegen step,
    // `generateRoutes` included, so a route added to a prototype has to move it — a version bump
    // does not, inside this repo, and the config never mentions those paths at all.
    .concat(`REST_SURFACE:${restSurface()}`)
    .join('\n');

  if (cache.matches('config', memoStr)) return false;

  cache.remember('config', memoStr);
  return true;
};

export default writeMemo;
