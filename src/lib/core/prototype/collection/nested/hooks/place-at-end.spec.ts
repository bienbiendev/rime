import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { placeAtEnd } from './place-at-end.server.js';

/** A create of `data` in `pages`, whose highest position under the parent is `last`. */
const create = async (data: Dic, last?: number) => {
  const findMany = vi.fn(async () => (last === undefined ? [] : [{ id: 'l', _position: last }]));
  const result = await placeAtEnd({
    config: { slug: 'pages' },
    data,
    event: { locals: { rime: { adapter: { collection: () => ({ findMany }) } } } },
    context: { params: {} }
  } as any);
  return { data: result.data, findMany };
};

describe('placeAtEnd', () => {
  it('puts a page sent without a position one past the last of its list', async () => {
    const { data, findMany } = await create({ title: 'C', _parent: 'p' }, 1);
    expect(data._position).toBe(2);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { where: { _parent: { equals: 'p' } } },
        sort: '-_position',
        limit: 1
      })
    );
  });

  it('starts an empty list at 0', async () => {
    expect((await create({ title: 'A', _parent: 'p' })).data._position).toBe(0);
  });

  it('reads the top pages for a page with no parent', async () => {
    const { data, findMany } = await create({ title: 'R' }, 4);
    expect(data._position).toBe(5);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ query: { where: { _parent: { is_null: true } } } })
    );
  });

  it('keeps a position sent, 0 included', async () => {
    const { data, findMany } = await create({ title: 'A', _parent: 'p', _position: 0 }, 3);
    expect(data._position).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
