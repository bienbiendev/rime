import type { User } from '#lib/core/auth/types.js';
import type { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import { getValueAtPath, isObjectLiteral, omit, setValueAtPath } from '#lib/util/object.js';
import { enclosingRowPath, isWithin } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { ConfigMap } from './config-map/types.js';

/**
 * The data and its config map without the fields the caller may not write, each with every field
 * below it. A key left in the map is a path the save replaces, and its stored rows would be
 * deleted.
 *
 * ```ts
 * // group('meta').access({ update: isAdmin }).fields(blocks('gallery', [image]))
 * // an editor: PATCH { meta: { gallery: [] } }  ->  data {}, configMap {}: the gallery stays
 * ```
 *
 * On an update, a list row the data sends that is stored, found by its `id` wherever it moved,
 * takes the stored value of each such field, sent or not: the save replaces the list it sits in.
 * Those paths come back as `kept`. A new row has nothing stored, and goes without.
 *
 * ```ts
 * // blocks('layout', [block('hero').fields(text('title'), image)]), `image` for admins only
 * // stored [b1 (image m1), b2 (image m2)], an editor: PATCH { layout: [b2, b1] }
 * // -> layout.0.image is m2's row, layout.1.image m1's, kept: ['layout.0.image', 'layout.1.image']
 * ```
 */
export const withoutDeniedFields = (args: {
  data: Dic;
  configMap: ConfigMap;
  operation: 'create' | 'update';
  user: User | undefined;
  /** The document an update writes. */
  id?: string;
  /** On an update, the document as stored, and its config map. */
  stored?: { doc: Dic; configMap: ConfigMap };
}) => {
  const { operation, user, id, stored } = args;
  const canWrite = (config: FormFieldBuilder) => mayWrite(config, operation, user, id);
  let data = args.data;
  const configMap = { ...args.configMap };

  for (const key of deniedKeys(args.configMap, canWrite)) {
    data = withoutValueAt(data, key);
    for (const path of Object.keys(configMap)) {
      if (isWithin(path, key)) delete configMap[path];
    }
  }

  const kept: string[] = [];
  if (stored) {
    const sentRows = rowPathsById(data);
    for (const key of deniedKeys(stored.configMap, canWrite)) {
      const storedRowPath = enclosingRowPath(key);
      if (!storedRowPath) continue;
      const storedRow = getValueAtPath<Dic>(storedRowPath, stored.doc);
      const row = sentRows.get(storedRow?.id);
      if (row === undefined) continue;
      // A block sent as another type holds other fields
      if (getValueAtPath<Dic>(row, data)?.type !== storedRow?.type) continue;

      // `layout.0.image` stored, its row sent at `layout.1` -> `layout.1.image`
      const moved = (path: string) => row + path.slice(storedRowPath.length);
      data = setValueAtPath(moved(key), data, getValueAtPath(key, stored.doc));
      for (const [path, config] of Object.entries(stored.configMap)) {
        if (isWithin(path, key)) configMap[moved(path)] = config;
      }
      kept.push(moved(key));
    }
  }

  return { data, configMap, kept };
};

/** The keys of `configMap` whose field the caller may not write, none below another. */
const deniedKeys = (configMap: ConfigMap, canWrite: (config: FormFieldBuilder) => boolean) => {
  const denied: string[] = [];
  for (const [key, config] of Object.entries(configMap)) {
    // A field below a denied one goes with it
    if (denied.some((parent) => isWithin(key, parent))) continue;
    if (!canWrite(config)) denied.push(key);
  }
  return denied;
};

/**
 * Where each list row of `value` sits, by its `id`.
 *
 * ```ts
 * rowPathsById({ layout: [{ id: 'b2' }, { id: 'b1' }] }); // Map { b2 => 'layout.0', b1 => 'layout.1' }
 * ```
 */
const rowPathsById = (value: unknown, path = '', rows = new Map<unknown, string>()) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const at = `${path}.${index}`;
      if (isObjectLiteral(item) && typeof item.id === 'string' && !rows.has(item.id)) {
        rows.set(item.id, at);
      }
      rowPathsById(item, at, rows);
    });
  } else if (isObjectLiteral(value)) {
    for (const [key, child] of Object.entries(value)) {
      rowPathsById(child, path ? `${path}.${key}` : key, rows);
    }
  }
  return rows;
};

/**
 * `data` without the value at `path`, the objects on the way to it copied: `data` itself is left
 * as it is.
 */
const withoutValueAt = (data: Dic, path: string): Dic => {
  const at = path.lastIndexOf('.');
  if (at === -1) return omit([path], data);
  const parent = path.slice(0, at);
  const holder = getValueAtPath(parent, data);
  if (!isObjectLiteral(holder)) return data;
  return setValueAtPath(parent, data, omit([path.slice(at + 1)], holder));
};

/** Whether this request may write the field: creating, or updating the document `id`. */
const mayWrite = (
  config: FormFieldBuilder,
  operation: 'create' | 'update',
  user: User | undefined,
  id?: string
) =>
  operation === 'update'
    ? config.use.accessUpdate(user, { id })
    : config.use.accessCreate(user, { id: undefined });
