import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import { tempId } from '$lib/util/random.js';
import type { Dic } from '$lib/util/types.js';
import cloneDeep from 'clone-deep';
import { initialValues } from './initial.js';
import { isFormField } from './util.js';
import { walkFields } from './walk.js';

/** What a field adds to its `use` when its default is a list of items to complete: blocks, tree. */
export type CompletesDefault<D extends Dic = Dic> = { completeDefault(value: D[]): Dic[] };

const completesDefault = (use: unknown): use is CompletesDefault =>
  typeof (use as CompletesDefault).completeDefault === 'function';

/**
 * One item of a default list, a block or a tree item, as a document holds it: the initial values
 * of its fields, the values the item names winning, its own lists completed, and a fresh
 * temporary id. A new copy on each call.
 *
 * ```ts
 * completeItem([text('title'), text('intro')], { title: 'Hello' });
 * // { id: 'temp-3f9aK2bQ', title: 'Hello', intro: null }
 * ```
 */
export const completeItem = (fields: FieldBuilder<Field>[], given: Dic): Dic => {
  let item: Dic = { ...initialValues(fields), ...cloneDeep(given) };

  // A nested list the item names is completed by its own field; one it leaves out already holds
  // that field's default, from `initialValues`.
  for (const { field, path } of walkFields(fields, { determinate: true })) {
    if (!isFormField(field)) continue;
    const use = field.use;
    const nested = getValueAtPath<Dic[]>(path, given);
    if (completesDefault(use) && Array.isArray(nested)) {
      item = setValueAtPath(path, item, use.completeDefault(nested));
    }
  }

  return { ...item, id: tempId() };
};
