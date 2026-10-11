import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';
import { getValueAtPath, recursiveRemoveKeys, setValueAtPath } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import { buildConfigMap } from './config-map/index.js';

/**
 * The data with `keys` removed from every row it holds — blocks, tree items, relation refs — so
 * those rows are written as new ones. A rich-text value is a value, not a row: it is kept whole,
 * so an upload or resource node keeps the `attrs.id` of the document it shows.
 *
 * ```ts
 * withoutRowKeys(
 *   { sections: [{ id: 'b1', body: { type: 'doc', content: [{ type: 'upload', attrs: { id: 'm1' } }] } }] },
 *   fields,
 *   ['id']
 * );
 * // { sections: [{ body: { type: 'doc', content: [{ type: 'upload', attrs: { id: 'm1' } }] } }] }
 * ```
 */
export const withoutRowKeys = (data: Dic, fields: FieldBuilder<Field>[], keys: string[]): Dic => {
  const richTexts = Object.entries(buildConfigMap(data, fields))
    .filter(([, field]) => field.type === 'richText')
    .map(([path]) => ({ path, value: getValueAtPath(path, data) }));

  let result = recursiveRemoveKeys(...keys).from(data) as Dic;
  for (const { path, value } of richTexts) {
    result = setValueAtPath(path, result, value);
  }
  return result;
};
