import { block, blocks, text } from '$lib/fields/index.js';
import { expect, test } from 'vitest';

const paragraph = block('paragraph').fields(text('text'), text('note').defaultValue('Note'));
const grid = block('grid').fields(
  text('title'),
  blocks('items', [paragraph]).defaultValue([{ type: 'paragraph', text: 'Inner' }])
);

const without = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(without)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== 'id')
            .map(([key, child]) => [key, without(child)])
        )
      : value;

test('a block names its type and the values it starts with; the rest comes from its fields', () => {
  const sections = blocks('sections', [paragraph]).defaultValue([
    { type: 'paragraph', text: 'Hello' }
  ]);

  expect(without(sections.use.defaultValue())).toEqual([
    { type: 'paragraph', path: null, position: null, text: 'Hello', note: 'Note' }
  ]);
});

test('each block has a temporary id, a new one on each call', () => {
  const sections = blocks('sections', [paragraph]).defaultValue([{ type: 'paragraph' }]);
  const [first] = sections.use.defaultValue() as { id: string }[];
  const [second] = sections.use.defaultValue() as { id: string }[];

  expect(first.id).toMatch(/^temp-/);
  expect(second.id).not.toBe(first.id);
  expect(second).not.toBe(first);
});

test('a nested list the default leaves out takes its own default', () => {
  const sections = blocks('sections', [grid, paragraph]).defaultValue([{ type: 'grid' }]);
  const [value] = sections.use.defaultValue() as any[];

  expect(without(value.items)).toEqual([
    { type: 'paragraph', path: null, position: null, text: 'Inner', note: 'Note' }
  ]);
  expect(value.items[0].id).toMatch(/^temp-/);
});

test('a nested list the default gives is completed against its own blocks', () => {
  const sections = blocks('sections', [grid, paragraph]).defaultValue([
    { type: 'grid', items: [{ type: 'paragraph', text: 'Mine' }] }
  ]);
  const [value] = sections.use.defaultValue() as any[];

  expect(without(value.items)).toEqual([
    { type: 'paragraph', path: null, position: null, text: 'Mine', note: 'Note' }
  ]);
});

test('the default given is not changed, and two calls share no object', () => {
  const given = [{ type: 'grid', items: [{ type: 'paragraph' }] }];
  const sections = blocks('sections', [grid, paragraph]).defaultValue(given);
  const [first] = sections.use.defaultValue() as any[];
  const [second] = sections.use.defaultValue() as any[];

  expect(given).toEqual([{ type: 'grid', items: [{ type: 'paragraph' }] }]);
  expect(second.items).not.toBe(first.items);
});

test('a function default is completed on each call', () => {
  const sections = blocks('sections', [paragraph]).defaultValue(() => [{ type: 'paragraph' }]);

  expect((sections.use.defaultValue() as any[])[0].id).toMatch(/^temp-/);
});

test('a type the list does not declare throws', () => {
  const sections = blocks('sections', [paragraph]).defaultValue([{ type: 'paragrah' }]);

  expect(() => sections.use.defaultValue()).toThrow(
    'sections.defaultValue(): "paragrah" is not a block of sections'
  );
});

test('a list without a default starts empty', () => {
  expect(blocks('sections', [paragraph]).use.defaultValue()).toEqual([]);
});
