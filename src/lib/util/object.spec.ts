import { expect, test } from 'vitest';
import { deleteValueAtPath, getValueAtPath, setValueAtPath, withDefaultValues } from './object.js';

test('withDefaultValues fills what is missing and leaves what is held', () => {
  const now = new Date();
  const doc = { id: '1', title: 'T', body: null, tags: [], when: now, seo: { og: 'x' }, extra: 1 };
  const defaults = {
    title: null,
    body: 'b',
    tags: ['a'],
    when: null,
    seo: { og: null, meta: null },
    views: 0
  };

  const out = withDefaultValues(doc, defaults);

  expect(out).toEqual({
    id: '1',
    title: 'T',
    body: null,
    tags: [],
    when: now,
    seo: { og: 'x', meta: null },
    extra: 1,
    views: 0
  });
  expect(out.when).toBe(now);
  expect(doc).toEqual({
    id: '1',
    title: 'T',
    body: null,
    tags: [],
    when: now,
    seo: { og: 'x' },
    extra: 1
  });
});

test('getValueAtPath reads keys made of the letter d, and array indexes', () => {
  expect(getValueAtPath('d', { d: 1 })).toBe(1);
  expect(getValueAtPath('list.1.dd', { list: [{}, { dd: 2 }] })).toBe(2);
});

test('getValueAtPath reads through a block type, and stops at a missing level', () => {
  expect(getValueAtPath('layout.0:hero.title', { layout: [{ title: 'a' }] })).toBe('a');
  expect(getValueAtPath('a.b.c', { a: {} })).toBeUndefined();
});

test('setValueAtPath copies each level on the path and leaves the rest shared', () => {
  const doc = { a: { b: { c: 1 } }, d: { e: 1 } };
  const next = setValueAtPath('a.b.c', doc, 2);
  expect(next.a.b.c).toBe(2);
  expect(doc.a.b.c).toBe(1);
  expect(next.d).toBe(doc.d);
});

test('setValueAtPath creates a list before an index, and strips a block type', () => {
  expect(setValueAtPath('tags.0', {}, 'x')).toEqual({ tags: ['x'] });
  expect(setValueAtPath('layout.0:hero.title', { layout: [{ title: 'a' }] }, 'b')).toEqual({
    layout: [{ title: 'b' }]
  });
});

test('deleteValueAtPath removes in place, and leaves a missing path alone', () => {
  const doc = { a: { b: 1, c: 2 } };
  expect(deleteValueAtPath(doc, 'a.b')).toBe(doc);
  expect(doc).toEqual({ a: { c: 2 } });
  expect(deleteValueAtPath(doc, 'x.y')).toEqual({ a: { c: 2 } });
});

test('a path through null or a primitive reads nothing and deletes nothing', () => {
  expect(getValueAtPath('a.b', { a: null })).toBeUndefined();
  expect(getValueAtPath('a.b', { a: 'x' })).toBeUndefined();
  expect(deleteValueAtPath({ a: null } as any, 'a.b')).toEqual({ a: null });
  expect(deleteValueAtPath({ a: 'x' } as any, 'a.b.c')).toEqual({ a: 'x' });
  expect(deleteValueAtPath({ a: { b: 1, c: 2 } }, 'a.b')).toEqual({ a: { c: 2 } });
});

test('set replaces any parent that cannot hold a key', () => {
  expect(setValueAtPath('a.b', { a: 0 }, 1)).toEqual({ a: { b: 1 } });
  expect(setValueAtPath('a.b', { a: 'str' }, 1)).toEqual({ a: { b: 1 } });
  expect(setValueAtPath('a.0', { a: true }, 1)).toEqual({ a: [1] });
});
