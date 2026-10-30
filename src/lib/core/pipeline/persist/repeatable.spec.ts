import { select, text, tree } from '#lib/fields/index.js';
import { describe, expect, test } from 'vitest';
import { buildConfigMap } from '../config-map/index.js';
import { diffRepeatables, movedPath, withinPaths } from './repeatable.server.js';
import { extractTreeBlocks } from './tree/extract.server.js';

const fields = [
  tree('menu').fields(text('label'), text('subtitle'), select('tags').options('a', 'b').many())
] as any[];

/** t1 > t2, then t3 */
const stored = () => ({
  menu: [
    {
      id: 't1',
      label: 'A',
      tags: ['a'],
      _children: [{ id: 't2', label: 'B', _children: [] as any[] }]
    },
    { id: 't3', label: 'C', _children: [] as any[] }
  ] as any[]
});

const updated = (data: { menu: any[] }) => {
  const configMap = buildConfigMap(data, fields);
  const { toUpdate } = diffRepeatables(
    extractTreeBlocks({ data: stored(), configMap: buildConfigMap(stored(), fields) }),
    extractTreeBlocks({ data, configMap })
  );
  return toUpdate.map((item) => item.id);
};

describe('diffRepeatables', () => {
  test('the same tree updates nothing', () => {
    expect(updated(stored())).toEqual([]);
  });

  test('a changed label updates its item', () => {
    const data = stored();
    data.menu[0]._children[0].label = 'B, edited';
    expect(updated(data)).toEqual(['t2']);
  });

  test('a select grown by a value updates its item', () => {
    const data = stored();
    data.menu[0].tags = ['a', 'b'];
    expect(updated(data)).toEqual(['t1']);
  });

  test('a value the stored item lacks updates it', () => {
    const data = stored();
    data.menu[1].subtitle = 'Hello';
    expect(updated(data)).toEqual(['t3']);
  });

  test('an item moved under another updates it', () => {
    const data = stored();
    const [t1, t3] = data.menu;
    t1._children.push(t3);
    data.menu = [t1];
    expect(updated(data)).toEqual(['t3']);
  });
});

describe('diffRepeatables, add and delete', () => {
  const rows = [
    { id: 'a', path: 'nav', position: 0, label: 'A', _children: [] },
    { id: 'b', path: 'nav', position: 1, label: 'B', _children: [] }
  ];

  test('adds new rows, deletes missing ones, updates changed ones', () => {
    const incoming = [
      { id: 'a', path: 'nav', position: 0, label: 'A', _children: [] },
      { id: 'temp-x', path: 'nav', position: 1, label: 'C', _children: [] }
    ];
    const diff = diffRepeatables(rows, incoming);
    expect(diff.toAdd.map((row) => row.id)).toEqual(['temp-x']);
    expect(diff.toDelete.map((row) => row.id)).toEqual(['b']);
    expect(diff.toUpdate).toEqual([]);
  });

  test('a numeric id is a new row, not an error', () => {
    expect(diffRepeatables([], [{ id: 5 as any, path: 'layout' }]).toAdd).toHaveLength(1);
  });

  test('withinPaths keeps rows under a saved path only', () => {
    const list = [
      { id: '1', path: 'nav' },
      { id: '2', path: 'navigation' }
    ];
    expect(withinPaths(list, ['nav']).map((row) => row.id)).toEqual(['1']);
  });
});

describe('diffRepeatables, moved', () => {
  const a = { id: 'a', path: 'nav', position: 0, label: 'A', _children: [] };
  const b = { id: 'b', path: 'nav', position: 1, label: 'B', _children: [] };

  test('a reorder moves both rows', () => {
    const incoming = [
      { ...b, position: 0 },
      { ...a, position: 1 }
    ];
    expect(diffRepeatables([a, b], incoming).moved).toEqual([
      { path: 'nav', from: 'nav.1', to: 'nav.0' },
      { path: 'nav', from: 'nav.0', to: 'nav.1' }
    ]);
  });

  test('an unchanged list moves nothing', () => {
    expect(diffRepeatables([a, b], [a, b]).moved).toEqual([]);
  });

  test('an item moved under another moves into its children', () => {
    const data = stored();
    const [t1, t3] = data.menu;
    t1._children.push(t3);
    data.menu = [t1];
    const { moved } = diffRepeatables(
      extractTreeBlocks({ data: stored(), configMap: buildConfigMap(stored(), fields) }),
      extractTreeBlocks({ data, configMap: buildConfigMap(data, fields) })
    );
    expect(moved).toEqual([{ path: 'menu.0._children', from: 'menu.1', to: 'menu.0._children.1' }]);
  });

  test('movedPath follows the innermost move holding the path', () => {
    const moves = [
      { path: 'menu', from: 'menu.0', to: 'menu.1' },
      { path: 'menu.1._children', from: 'menu.0._children.0', to: 'menu.1._children.2' }
    ];
    expect(movedPath('menu.0._children.0.image', moves)).toBe('menu.1._children.2.image');
    expect(movedPath('menu.0.image', moves)).toBe('menu.1.image');
    expect(movedPath('menu.2.image', moves)).toBeNull();
  });
});
