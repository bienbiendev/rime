import type { TreeBlock } from '#lib/core/prototype/types.js';
import { getValueAtPath } from '#lib/util/object.js';
import { tempId } from '#lib/util/random.js';
import { normalizeFieldPath } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import cloneDeep from 'clone-deep';
import { rebuildPaths } from './blocks-ops.js';

/**
 * The tree field's operations, over a plain list of items. `treePath` is the field's own path,
 * `links`. Each answers a new list, with every path and position rewritten.
 */

/**
 * The list a tree-relative path points into, and the index in it. A missing `_children` is
 * created on the way down.
 *
 * ```ts
 * locate(items, '0._children.1') // { list: items[0]._children, index: 1 }
 * locate(items, '2')             // { list: items, index: 2 }
 * ```
 */
const locate = (items: TreeBlock[], path: string) => {
  const parts = normalizeFieldPath(path).split('.');
  let list = items;
  for (const part of parts.slice(0, -1)) {
    if (part !== '_children') {
      list = list[parseInt(part)]._children ||= [];
    }
  }
  return { list, index: parseInt(parts[parts.length - 1]) };
};

/**
 * A new item at the end of `atPath`: the tree's own list, or one inside an item,
 * `links.0._children`. `undefined` when no item sits at `atPath`.
 */
export const addItem = (
  items: TreeBlock[],
  treePath: string,
  emptyFields: Dic,
  atPath: string = treePath
) => {
  const next = cloneDeep(items);
  let target = next;
  if (atPath !== treePath) {
    const parent = getValueAtPath<TreeBlock>(
      atPath.replace(`${treePath}.`, '').replace(/\._children$/, ''),
      next
    );
    if (!parent) return;
    parent._children ??= [];
    target = parent._children;
  }
  target.push({
    ...emptyFields,
    id: tempId(),
    path: atPath,
    position: target.length,
    _children: []
  });
  return rebuildPaths(next, treePath);
};

/** The tree without the item at `index` of `atPath`: the tree's list, or `links.0._children`. */
export const deleteItem = (items: TreeBlock[], treePath: string, atPath: string, index: number) => {
  const next = cloneDeep(items);
  const list = getValueAtPath<TreeBlock[]>(atPath.replace(`${treePath}.`, ''), next) || next;
  list.splice(index, 1);
  return rebuildPaths(next, treePath);
};

/**
 * The item at `from` moved to `to`. Both paths are relative to the tree, `0._children.1`, and
 * name it as it is before the move.
 */
export const moveItem = (items: TreeBlock[], treePath: string, from: string, to: string) => {
  const next = cloneDeep(items);
  const source = locate(next, from);
  const target = locate(next, to);
  const [moved] = source.list.splice(source.index, 1);
  target.list.splice(target.index, 0, moved);
  return rebuildPaths(next, treePath);
};
