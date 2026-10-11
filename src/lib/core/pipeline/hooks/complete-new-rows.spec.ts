import { block, blocks, group, text, tree } from '#lib/fields/index.js';
import type { Dic } from '#lib/util/types.js';
import { expect, test } from 'vitest';
import { completeNewRows } from './complete-new-rows.server.js';

const paragraph = block('paragraph').fields(text('text'));
const fields = [
  blocks('layout', [
    block('cta').fields(
      text('title').required(),
      text('label').defaultValue('Go'),
      group('meta').fields(text('note'), text('kind').defaultValue('plain'))
    ),
    block('grid').fields(text('title'), blocks('items', [paragraph]))
  ]),
  tree('menu').fields(text('label'), text('url').defaultValue('/'))
];

const complete = async (data: Dic) =>
  (
    (await completeNewRows({
      config: { fields },
      data,
      event: {},
      operation: 'create',
      context: {}
    } as any)) as any
  ).data;

test('a new block gets the fields it did not send: its default, else null', async () => {
  const { layout } = await complete({ layout: [{ type: 'cta' }] });
  expect(layout[0]).toMatchObject({ type: 'cta', title: null, label: 'Go' });
});

test('a row with a temporary id is completed, a row with a saved id comes back as sent', async () => {
  const { layout } = await complete({
    layout: [
      { id: 'temp-a1', type: 'cta' },
      { id: 'b1', type: 'cta' }
    ]
  });
  expect(layout[0]).toMatchObject({ id: 'temp-a1', title: null, label: 'Go' });
  expect(layout[1]).toEqual({ id: 'b1', type: 'cta' });
});

test('a new tree item and a new child under _children are completed', async () => {
  const { menu } = await complete({ menu: [{ label: 'A', _children: [{ label: 'B' }] }] });
  expect(menu[0]).toMatchObject({ label: 'A', url: '/' });
  expect(menu[0]._children[0]).toMatchObject({ label: 'B', url: '/' });
});

test('a new row in a nested list is completed, inside a new row or a saved one', async () => {
  const fresh = await complete({ layout: [{ type: 'grid', items: [{ type: 'paragraph' }] }] });
  expect(fresh.layout[0]).toMatchObject({ title: null });
  expect(fresh.layout[0].items[0]).toMatchObject({ type: 'paragraph', text: null });

  const saved = await complete({
    layout: [{ id: 'b1', type: 'grid', items: [{ type: 'paragraph' }] }]
  });
  expect(saved.layout[0]).not.toHaveProperty('title');
  expect(saved.layout[0].items[0]).toMatchObject({ type: 'paragraph', text: null });
});

test('a group inside a new row gets its missing members', async () => {
  const { layout } = await complete({ layout: [{ type: 'cta', meta: { note: 'n' } }] });
  expect(layout[0].meta).toEqual({ note: 'n', kind: 'plain' });
});

test('the data passed in is unchanged', async () => {
  const data = {
    layout: [{ type: 'grid', items: [{ type: 'paragraph' }] }],
    menu: [{ label: 'A', _children: [{ label: 'B' }] }]
  };
  const before = structuredClone(data);
  await complete(data);
  expect(data).toEqual(before);
});
