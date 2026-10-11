import type { Dic } from '#lib/util/types.js';
import { CONFIG_DIR, PANEL_ROUTE } from './constants.server.js';
import { restSurface } from './prototype-routes.server.js';
import { templatesSurface } from './codegen/routes/common.server.js';
import { rimeVersion } from './version.server.js';

/**
 * Serializes one flattened config value for the memo: a builder by its `compile()` output, a
 * function by its source, an object by its JSON.
 */
const serializeValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'function':
      // A Svelte component (its dev SSR build carries a `render` stub) serializes by name; any
      // other function by its source.
      if (Object.prototype.hasOwnProperty.call(value, 'render')) {
        return `func:${value.name}`;
      }
      return `func:${value.toString()}`;

    case 'object':
      try {
        // Builder instances (fields, tabs, blocks, ...) may keep their state in private class
        // fields, which JSON.stringify() cannot see. Their `compile()` returns a plain, fully
        // resolved copy, so that is what gets serialized.
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

/**
 * The config as leaves keyed by their path, as `flat` writes them. A value that holds one of its
 * own ancestors stops there: a rich text `upload()` or `fields()` feature holds a tiptap
 * extension, whose `parent.child` is itself.
 *
 * ```ts
 * flattenConfig({ a: { b: 1 }, list: [2] }); // { 'a.b': 1, 'list.0': 2 }
 * ```
 */
export const flattenConfig = (
  value: unknown,
  prefix = '',
  out: Dic = {},
  ancestors = new Set<object>()
): Dic => {
  const isBranch = !!value && typeof value === 'object' && !(value instanceof Date);
  if (!isBranch) {
    out[prefix] = value;
    return out;
  }
  if (ancestors.has(value)) {
    out[prefix] = 'circular';
    return out;
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    out[prefix] = value;
    return out;
  }
  ancestors.add(value);
  for (const key of keys) {
    flattenConfig((value as Dic)[key], prefix ? `${prefix}.${key}` : key, out, ancestors);
  }
  ancestors.delete(value);
  return out;
};

/**
 * Everything codegen reads, as one string: two boots with the same string have nothing to
 * generate. It stores nothing: `runCodegen` stores it once every step has written its files.
 */
const configMemo = <T extends object>(config: T): string => {
  const memo = flattenConfig(config);
  return (
    Object.entries(memo)
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
      // Nor is the panel's URL segment, which the generated `panel` param matcher accepts
      .concat(`PANEL_ROUTE:${PANEL_ROUTE}`)
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
      // Nor are the route templates, which change inside this repo and between two packs of one
      // version: the routes they write must follow.
      .concat(`ROUTE_TEMPLATES:${templatesSurface()}`)
      .join('\n')
  );
};

export default configMemo;
