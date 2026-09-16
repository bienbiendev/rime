import { expect, test } from 'vitest';
import { withDefaults } from './object.js';

test('withDefaults fills what is missing and leaves what is held', () => {
  const now = new Date();
  const doc = { id: '1', title: 'T', body: null, tags: [], when: now, seo: { og: 'x' }, extra: 1 };
  const blank = {
    title: null,
    body: 'b',
    tags: ['a'],
    when: null,
    seo: { og: null, meta: null },
    views: 0
  };

  const out = withDefaults(doc, blank);

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
