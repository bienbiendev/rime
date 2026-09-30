import { text, tree } from '$lib/fields/index.js';
import { expect, test } from 'vitest';

test('each item gets a temporary id, the fields it leaves out, and its children the same way', () => {
  const menu = tree('menu')
    .fields(text('label'), text('url').defaultValue('/'))
    .defaultValue([{ label: 'Home', _children: [{ label: 'About' }] }]);

  const [home] = menu.use.defaultValue() as any[];

  expect(home).toMatchObject({ label: 'Home', url: '/', path: null, position: null });
  expect(home.id).toMatch(/^temp-/);
  expect(home._children).toHaveLength(1);
  expect(home._children[0]).toMatchObject({ label: 'About', url: '/', _children: [] });
  expect(home._children[0].id).toMatch(/^temp-/);
});

test('a tree without a default starts empty', () => {
  expect(tree('menu').fields(text('label')).use.defaultValue()).toEqual([]);
});
