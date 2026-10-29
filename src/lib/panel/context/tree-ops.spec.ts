import type { TreeBlock } from '#lib/core/prototype/types.js';
import { describe, expect, it } from 'vitest';
import { addItem, deleteItem, moveItem } from './tree-ops.js';

const item = (id: string, path: string, position: number, _children: TreeBlock[] = []) => ({
  id,
  path,
  position,
  _children
});

// links: a, b (b1, b2), c
const tree = (): TreeBlock[] => [
  item('a', 'links', 0),
  item('b', 'links', 1, [item('b1', 'links.1._children', 0), item('b2', 'links.1._children', 1)]),
  item('c', 'links', 2)
];

const ids = (items: TreeBlock[]): unknown[] =>
  items.map((i) => (i._children.length ? [i.id, ids(i._children)] : i.id));

describe('moveItem', () => {
  it('moves within the root list', () => {
    const next = moveItem(tree(), 'links', '0', '2');
    expect(ids(next)).toEqual([['b', ['b1', 'b2']], 'c', 'a']);
    expect(next.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it('moves into an item’s children, with paths and positions rewritten', () => {
    // Both paths name the tree as it is before the move: b is still `1`.
    const next = moveItem(tree(), 'links', '0', '1._children.1');
    expect(ids(next)).toEqual([['b', ['b1', 'a', 'b2']], 'c']);
    expect(next[0]).toMatchObject({ id: 'b', path: 'links', position: 0 });
    expect(next[0]._children[1]).toMatchObject({
      id: 'a',
      path: 'links.0._children',
      position: 1
    });
  });

  it('moves out of an item’s children', () => {
    const next = moveItem(tree(), 'links', '1._children.0', '0');
    expect(ids(next)).toEqual(['b1', 'a', ['b', ['b2']], 'c']);
    expect(next[2]._children[0]).toMatchObject({
      id: 'b2',
      path: 'links.2._children',
      position: 0
    });
  });

  it('creates a missing `_children` on the way down', () => {
    const items = tree();
    delete (items[0] as Partial<TreeBlock>)._children;
    const next = moveItem(items, 'links', '2', '0._children.0');
    expect(ids(next)).toEqual([
      ['a', ['c']],
      ['b', ['b1', 'b2']]
    ]);
  });

  it('leaves the given list as it was', () => {
    const items = tree();
    moveItem(items, 'links', '0', '2');
    expect(items).toEqual(tree());
  });
});

describe('addItem', () => {
  it('appends to the root list', () => {
    const next = addItem(tree(), 'links', { label: 'd' });
    expect(next?.[3]).toMatchObject({ label: 'd', path: 'links', position: 3, _children: [] });
    expect(next?.[3].id).toMatch(/^temp-/);
  });

  it('appends inside an item', () => {
    const next = addItem(tree(), 'links', { label: 'b3' }, 'links.1._children');
    expect(next?.[1]._children[2]).toMatchObject({
      label: 'b3',
      path: 'links.1._children',
      position: 2
    });
  });

  it('answers undefined when no item sits at the path', () => {
    expect(addItem(tree(), 'links', {}, 'links.9._children')).toBeUndefined();
  });
});

describe('deleteItem', () => {
  it('removes from the root list and renumbers', () => {
    const next = deleteItem(tree(), 'links', 'links', 0);
    expect(ids(next)).toEqual([['b', ['b1', 'b2']], 'c']);
    expect(next[0]._children[1]).toMatchObject({ path: 'links.0._children', position: 1 });
  });

  it('removes inside an item', () => {
    const next = deleteItem(tree(), 'links', 'links.1._children', 0);
    expect(ids(next)).toEqual(['a', ['b', ['b2']], 'c']);
    expect(next[1]._children[0]).toMatchObject({ id: 'b2', position: 0 });
  });
});
