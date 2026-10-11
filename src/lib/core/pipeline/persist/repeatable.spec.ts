import { select, text, tree } from '#lib/fields/index.js';
import { describe, expect, test } from 'vitest';
import { buildConfigMap } from '../config-map/index.js';
import { diffRepeatables, withinPaths } from './repeatable.server.js';
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

  test('withinPaths keeps rows under a saved path only', () => {
    const list = [
      { id: '1', path: 'nav' },
      { id: '2', path: 'navigation' }
    ];
    expect(withinPaths(list, ['nav']).map((row) => row.id)).toEqual(['1']);
  });
});
