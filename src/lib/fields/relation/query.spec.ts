import qs from 'qs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { namedByQuery, queryOf } from './query.js';

describe('queryOf', () => {
  it('answers a function query for the values given', () => {
    const field = { query: (doc: any) => `where[country][equals]=${doc.country}` };
    expect(queryOf(field, { country: 'fr' })).toBe('where[country][equals]=fr');
    expect(queryOf(field, { country: 'it' })).toBe('where[country][equals]=it');
  });

  it('answers a string query as is, and an empty string without a query', () => {
    expect(queryOf({ query: 'where[mimeType][like]=image%' }, {})).toBe(
      'where[mimeType][like]=image%'
    );
    expect(queryOf({}, {})).toBe('');
  });
});

describe('namedByQuery', () => {
  const jpg = { id: 'jpg' };
  const pdf = { id: 'pdf' };

  /** A `fetch` that answers `ids` as the docs found. */
  const answer = (ids: string[], ok = true) => {
    const fetch = vi.fn(async () => ({
      ok,
      json: async () => ({ docs: ids.map((id) => ({ id })) })
    }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers the docs the collection names for the query and the ids', async () => {
    const fetch = answer(['jpg']);
    const docs = await namedByQuery('/api/medias', 'where[mimeType][like]=image%', [jpg, pdf]);
    expect(docs).toEqual([jpg]);

    const [url] = fetch.mock.calls[0] as unknown as [string];
    const [path, search] = url.split('?');
    expect(path).toBe('/api/medias');
    expect(qs.parse(search).where).toEqual({
      and: [{ mimeType: { like: 'image%' } }, { id: { in_array: ['jpg', 'pdf'] } }]
    });
  });

  it('answers every doc, with no request, when the query has no where', async () => {
    const fetch = answer([]);
    expect(await namedByQuery('/api/medias', '', [jpg, pdf])).toEqual([jpg, pdf]);
    expect(await namedByQuery('/api/medias', 'sort=title', [jpg])).toEqual([jpg]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers no doc when the request fails', async () => {
    answer(['jpg'], false);
    expect(await namedByQuery('/api/medias', 'where[mimeType][like]=image%', [jpg])).toEqual([]);
  });
});
