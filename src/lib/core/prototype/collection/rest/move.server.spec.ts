import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { moveNested } from '#lib/core/prototype/collection/nested/move.server.js';
import { restMove } from './move.server.js';

vi.mock('#lib/core/prototype/collection/nested/move.server.js', () => ({
  moveNested: vi.fn(async () => ({ id: 'c' }))
}));

/** `POST /api/pages/c/move<search>` with `body`, from staff, on a nested `pages` unless told. */
const post = (body: Dic, args: { search?: string; nested?: boolean } = {}) => {
  vi.mocked(moveNested).mockClear();
  const url = `https://site.com/api/pages/c/move${args.search ?? ''}`;
  const event = {
    params: { id: 'c' },
    url: new URL(url),
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }),
    locals: {
      user: { id: 's1', isStaff: true },
      rime: {
        routes: { slug: 'pages' },
        config: { isCollection: () => true },
        collection: () => ({ config: { slug: 'pages', nested: args.nested ?? true } })
      }
    }
  };
  return restMove(event as any);
};

describe('restMove', () => {
  it('moves the page with the list sent and the row the query names', async () => {
    const response = await post({ parent: 'p', order: ['c', 'a'] }, { search: '?versionId=v1' });
    expect(await response.json()).toEqual({ doc: { id: 'c' } });
    expect(moveNested).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c', parent: 'p', order: ['c', 'a'], versionId: 'v1' })
    );
  });

  it('takes `null` for the top', async () => {
    await post({ parent: null, order: ['a', 'c'] });
    expect(moveNested).toHaveBeenCalledWith(expect.objectContaining({ parent: null }));
  });

  it.each([
    ['no parent', { order: ['c'] }],
    ['an order without the page', { parent: 'p', order: ['a'] }],
    ['an order that is not a list of ids', { parent: 'p', order: 'c' }]
  ])('answers 400 for %s, and moves nothing', async (_, body) => {
    await expect(post(body)).rejects.toMatchObject({ status: 400 });
    expect(moveNested).not.toHaveBeenCalled();
  });

  it('answers 400 on a collection that is not nested', async () => {
    await expect(post({ parent: 'p', order: ['c'] }, { nested: false })).rejects.toMatchObject({
      status: 400
    });
    expect(moveNested).not.toHaveBeenCalled();
  });
});
