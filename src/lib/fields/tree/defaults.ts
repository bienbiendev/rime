import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { completeItem } from '$lib/core/fields/complete.js';
import type { Field } from '$lib/fields/types.js';
import type { Dic } from '$lib/util/types.js';

/** A tree item in a default: the values it starts with, and its own items. */
export type TreeItemDefault = Dic & { _children?: TreeItemDefault[] };

/**
 * A default tree as a document holds it: each item with a fresh temporary id and the initial
 * values of the tree's fields, the values it names winning, its `_children` completed the same
 * way. A new copy on each call.
 *
 * ```ts
 * completeTree([text('label')], [{ label: 'Home', _children: [{ label: 'About' }] }]);
 * // [{
 * //   id: 'temp-…', path: null, position: null, label: 'Home',
 * //   _children: [{ id: 'temp-…', path: null, position: null, label: 'About', _children: [] }]
 * // }]
 * ```
 */
export const completeTree = (fields: FieldBuilder<Field>[], value: TreeItemDefault[]): Dic[] =>
  value.map((given) => ({
    ...completeItem(fields, given),
    _children: completeTree(fields, given._children ?? [])
  }));
