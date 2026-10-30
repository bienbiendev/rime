import qs from 'qs';
import { describe, expect, test } from 'vitest';
import { candidatesURL, countURL, pageURL, picksURL } from './candidates.svelte.js';

const targets = { kebab: 'targets', asTitle: 'title' };

/** The path and the parsed query of a url. */
const parse = (url: string) => {
  const [path, search = ''] = url.split('?');
  return { path, params: qs.parse(search) };
};

describe('picksURL', () => {
  test('names every id, sorted, at depth 1', () => {
    expect(parse(picksURL(targets, ['b', 'a']))).toEqual({
      path: '/api/targets',
      params: { where: { id: { in_array: ['a', 'b'] } }, depth: '1' }
    });
  });

  test('reads the same url for the same picks in another order', () => {
    expect(picksURL(targets, ['a', 'b'])).toBe(picksURL(targets, ['b', 'a']));
  });
});

describe('candidatesURL', () => {
  test("holds the picker's query, the picks left out and the title search, at most 20", () => {
    const where = {
      config: targets,
      query: 'where[kind][equals]=a',
      exclude: ['p1'],
      search: 'alp'
    };
    expect(parse(candidatesURL(where))).toEqual({
      path: '/api/targets',
      params: {
        where: {
          and: [
            { kind: { equals: 'a' } },
            { id: { not_in_array: ['p1'] } },
            { title: { like: '%alp%' } }
          ]
        },
        limit: '20'
      }
    });
  });

  test('has no where when there is nothing to filter, and a depth when asked', () => {
    expect(parse(candidatesURL({ config: targets }, 1))).toEqual({
      path: '/api/targets',
      params: { limit: '20', depth: '1' }
    });
  });
});

describe('countURL', () => {
  test("reads the count route with the candidates' where", () => {
    const where = { config: targets, exclude: ['p1'], search: 'alp' };
    expect(parse(countURL(where))).toEqual({
      path: '/api/targets/count',
      params: {
        where: { and: [{ id: { not_in_array: ['p1'] } }, { title: { like: '%alp%' } }] }
      }
    });
  });

  test('is the bare count route when there is nothing to filter', () => {
    expect(countURL({ config: targets })).toBe('/api/targets/count');
  });
});

describe('pageURL', () => {
  test('holds the where, the sort, the limit and the offset of one step', () => {
    const where = {
      config: { kebab: 'pages', asTitle: 'title' },
      query: 'where[_parent][equals]=blog'
    };
    expect(parse(pageURL(where, { sort: '_position', limit: 20, offset: 20 }))).toEqual({
      path: '/api/pages',
      params: {
        where: { and: [{ _parent: { equals: 'blog' } }] },
        sort: '_position',
        limit: '20',
        offset: '20'
      }
    });
  });
});
