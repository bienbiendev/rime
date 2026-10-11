import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { listParams, readParams, requestData, writeParams } from './params.server.js';

/** The `depth` an anonymous GET with `search` reads at. */
const depthOf = (search: string) => {
  const event = {
    url: new URL(`http://localhost/api/pages${search}`),
    locals: { user: undefined }
  };
  return readParams(event as any, 'title').depth;
};

describe('readParams', () => {
  it('reads a negative depth as 0', () => {
    expect(depthOf('?depth=-2')).toBe(0);
  });

  it('reads a missing or unreadable depth as 0, and keeps a whole one', () => {
    expect(depthOf('')).toBe(0);
    expect(depthOf('?depth=abc')).toBe(0);
    expect(depthOf('?depth=2')).toBe(2);
  });
});

describe('writeParams', () => {
  /** The write parameters of a PATCH with `search`, from `user`. */
  const paramsOf = (user: unknown, search = '?versionId=v2&latest=true&fork=true') =>
    writeParams({
      url: new URL(`http://localhost/api/posts/p1${search}`),
      locals: { user }
    } as any);

  it('drops versionId and latest from a caller who is not staff, and keeps fork', () => {
    expect(paramsOf({ id: 'u1' })).toEqual({ versionId: undefined, latest: undefined, fork: true });
    expect(paramsOf(undefined)).toEqual({ versionId: undefined, latest: undefined, fork: true });
  });

  it('keeps all three from staff', () => {
    expect(paramsOf({ id: 's1', isStaff: true })).toEqual({
      versionId: 'v2',
      latest: true,
      fork: true
    });
  });
});

describe('listParams', () => {
  const listOf = (search: string) =>
    listParams({ url: new URL(`http://localhost/api/pages${search}`) } as any);

  it('answers 400 to a limit or an offset that is not a whole number in range', () => {
    for (const search of ['?limit=abc', '?limit=0', '?limit=1.5', '?offset=-1']) {
      expect(() => listOf(search)).toThrow(expect.objectContaining({ status: 400 }));
    }
  });

  it('reads the filter, the sort, the limit and the offset', () => {
    const { query, ...rest } = listOf('?where[title][equals]=Home&sort=-title&limit=10&offset=0');
    expect(query!.where).toEqual({ title: { equals: 'Home' } });
    expect(rest).toEqual({ sort: '-title', limit: 10, offset: 0 });
    expect(listOf('')).toEqual({
      query: undefined,
      sort: undefined,
      limit: undefined,
      offset: undefined
    });
  });
});

/** A JSON POST to /api/pages carrying `body`. */
const eventWith = (body: Dic) =>
  ({
    request: new Request('https://site.com/api/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  }) as unknown as RequestEvent;

describe('requestData', () => {
  it('answers 400 to a body that names a locale', async () => {
    await expect(requestData(eventWith({ locale: 'fr', title: 'x' }))).rejects.toMatchObject({
      status: 400
    });
  });

  it('reads a body without one as it is', async () => {
    expect(await requestData(eventWith({ title: 'x' }))).toEqual({ title: 'x' });
  });
});
