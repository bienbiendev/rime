import { expect, test } from 'vitest';
import { withDefaultValues } from './object.js';

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
