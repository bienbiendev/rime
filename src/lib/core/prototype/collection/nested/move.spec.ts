import { RimeError } from '#lib/core/errors/index.js';
import { authorize } from '#lib/core/pipeline/hooks/authorize.server.js';
import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { refuseCyclicParent } from './hooks/refuse-cyclic-parent.server.js';
import { moveNested } from './move.server.js';

type Row = { id: string; _parent: string | null; _position: number; updatedAt: string };

const row = (id: string, parent: string | null, position: number): Row => ({
  id,
  _parent: parent,
  _position: position,
  updatedAt: 'before'
});

/**
 * A `pages` table of `rows`. The collection's update runs the two hooks a move relies on, the
 * access check and the cycle check, then writes the row and its `updatedAt`. `mayUpdate` is the
 * update rule, by page id.
 */
const setup = (rows: Row[], mayUpdate: (id: string) => boolean = () => true) => {
  const table = new Map(rows.map((stored) => [stored.id, { ...stored }]));
  const pages = {
    findMany: vi.fn(async ({ query }: Dic) =>
      (query.where.id.in_array as string[]).flatMap((id) => {
        const stored = table.get(id);
        return stored ? [{ id, _parent: stored._parent, _position: stored._position }] : [];
      })
    ),
    find: async ({ id }: { id: string }) => table.get(id),
    updateWhere: vi.fn(async ({ query, data }: Dic) => {
      Object.assign(table.get(query.where.id.equals)!, data);
    })
  };
  const config = {
    slug: 'pages',
    access: { update: (_user: unknown, { id }: { id: string }) => mayUpdate(id) }
  };
  const event = {
    locals: { user: { id: 's1' }, rime: { adapter: { collection: () => pages } } }
  } as any;
  const updateById = vi.fn(async ({ id, data }: { id: string; data: Dic }) => {
    const context = { params: { id } };
    await authorize({ config, event, operation: 'update', context } as any);
    await refuseCyclicParent({ config, event, data, context } as any);
    Object.assign(table.get(id)!, data, { updatedAt: 'after' });
    return { ...table.get(id)! };
  });
  const collection = { config, updateById } as any;

  const move = (id: string, parent: string | null, order: string[]) =>
    moveNested({ event, collection, id, parent, order });
  /** Each page of the list under `parent`, by position. */
  const listOf = (parent: string | null) =>
    [...table.values()]
      .filter((stored) => stored._parent === parent)
      .sort((a, b) => a._position - b._position)
      .map((stored) => `${stored.id} ${stored._position}`);
  return { table, pages, updateById, move, listOf };
};

describe('moveNested', () => {
  it('stores the order dropped when the positions tie', async () => {
    const { move, listOf } = setup([
      row('p', null, 0),
      row('a', 'p', 0),
      row('b', 'p', 0),
      row('c', 'p', 0)
    ]);
    await move('c', 'p', ['c', 'a', 'b']);
    expect(listOf('p')).toEqual(['c 0', 'a 1', 'b 2']);
  });

  it('updates the moved page as a document, and writes only the position of the others', async () => {
    const { table, pages, updateById, move } = setup([
      row('a', null, 0),
      row('b', null, 0),
      row('c', null, 0)
    ]);
    await move('c', null, ['c', 'a', 'b']);

    expect(updateById).toHaveBeenCalledOnce();
    expect(updateById.mock.calls[0][0]).toMatchObject({
      id: 'c',
      data: { _parent: null, _position: 0 }
    });
    expect(pages.updateWhere.mock.calls.map(([call]) => call)).toEqual([
      { query: { where: { id: { equals: 'a' } } }, data: { _position: 1 } },
      { query: { where: { id: { equals: 'b' } } }, data: { _position: 2 } }
    ]);
    expect(table.get('a')!.updatedAt).toBe('before');
    expect(table.get('b')!.updatedAt).toBe('before');
    expect(table.get('c')!.updatedAt).toBe('after');
  });

  it('leaves alone a page whose position does not change', async () => {
    const { pages, move } = setup([row('a', null, 0), row('b', null, 1), row('c', null, 2)]);
    await move('c', null, ['a', 'c', 'b']);
    expect(pages.updateWhere.mock.calls.map(([call]) => call.query.where.id.equals)).toEqual(['b']);
  });

  it('moves a child to the top among the root pages', async () => {
    const { move, listOf } = setup([row('r1', null, 0), row('r2', null, 1), row('x', 'r1', 0)]);
    await move('x', null, ['r1', 'x', 'r2']);
    expect(listOf(null)).toEqual(['r1 0', 'x 1', 'r2 2']);
    expect(listOf('r1')).toEqual([]);
  });

  it('moves a page under another parent, and leaves its old list as it was', async () => {
    const { pages, move, listOf } = setup([
      row('p', null, 0),
      row('q', null, 1),
      row('a', 'p', 0),
      row('x', 'p', 1),
      row('b', 'p', 2),
      row('q1', 'q', 0)
    ]);
    // `a` is under another parent: the list under `q` skips it
    await move('x', 'q', ['a', 'q1', 'x']);
    expect(listOf('q')).toEqual(['q1 0', 'x 1']);
    expect(listOf('p')).toEqual(['a 0', 'b 2']);
    expect(pages.updateWhere).not.toHaveBeenCalled();
  });

  it('writes nothing when the caller may not update the moved page', async () => {
    const { pages, updateById, move } = setup(
      [row('a', null, 0), row('b', null, 0)],
      (id) => id !== 'b'
    );
    await expect(move('b', null, ['b', 'a'])).rejects.toMatchObject({
      code: RimeError.UNAUTHORIZED
    });
    expect(pages.updateWhere).not.toHaveBeenCalled();
    expect(updateById).not.toHaveBeenCalled();
  });

  it('writes nothing when the caller may not update a page whose position changes', async () => {
    const { pages, updateById, move } = setup(
      [row('a', null, 0), row('b', null, 1), row('c', null, 2)],
      (id) => id !== 'a'
    );
    await expect(move('c', null, ['c', 'a', 'b'])).rejects.toMatchObject({
      code: RimeError.UNAUTHORIZED
    });
    expect(pages.updateWhere).not.toHaveBeenCalled();
    expect(updateById).not.toHaveBeenCalled();

    // A page whose position stays is not written, so its rule is not asked
    const { move: moveLast } = setup(
      [row('a', null, 0), row('b', null, 1), row('c', null, 2)],
      (id) => id !== 'a'
    );
    await expect(moveLast('b', null, ['a', 'c', 'b'])).resolves.toBeDefined();
  });

  it('refuses a page under its own child, and puts the positions back', async () => {
    const { table, move, listOf } = setup([
      row('p', null, 0),
      row('c', 'p', 0),
      row('d', 'c', 0),
      row('e', 'c', 1)
    ]);
    await expect(move('p', 'c', ['p', 'd', 'e'])).rejects.toMatchObject({
      code: RimeError.BAD_REQUEST
    });
    expect(listOf('c')).toEqual(['d 0', 'e 1']);
    expect(table.get('p')).toMatchObject({ _parent: null, updatedAt: 'before' });
  });

  it('refuses a caller who may not update the page before reading it, as a PATCH does', async () => {
    const { pages, move } = setup([row('a', null, 0)], (id) => id !== 'gone');
    await expect(move('gone', null, ['gone', 'a'])).rejects.toMatchObject({
      code: RimeError.UNAUTHORIZED
    });
    expect(pages.findMany).not.toHaveBeenCalled();
  });

  it('puts back the positions written when a later one fails', async () => {
    const { pages, updateById, move, listOf } = setup([
      row('a', null, 0),
      row('b', null, 1),
      row('c', null, 2)
    ]);
    const write = pages.updateWhere.getMockImplementation()!;
    pages.updateWhere.mockImplementation(async (args: Dic) => {
      if (args.query.where.id.equals === 'b' && args.data._position === 2) {
        throw new Error('disk full');
      }
      return write(args);
    });
    await expect(move('c', null, ['c', 'a', 'b'])).rejects.toThrow('disk full');
    expect(listOf(null)).toEqual(['a 0', 'b 1', 'c 2']);
    expect(updateById).not.toHaveBeenCalled();
  });

  it('keeps the new order when the moved page is written and an after-update hook fails', async () => {
    const { table, updateById, move, listOf } = setup([
      row('a', null, 0),
      row('b', null, 1),
      row('c', null, 2)
    ]);
    updateById.mockImplementationOnce(async ({ id, data }: { id: string; data: Dic }) => {
      Object.assign(table.get(id)!, data, { updatedAt: 'after' });
      throw new Error('afterUpdate failed');
    });
    await expect(move('c', null, ['c', 'a', 'b'])).rejects.toThrow('afterUpdate failed');
    expect(listOf(null)).toEqual(['c 0', 'a 1', 'b 2']);
  });

  it('answers 404 for a page that is not stored, and writes nothing', async () => {
    const { pages, move } = setup([row('a', null, 0)]);
    await expect(move('gone', null, ['gone', 'a'])).rejects.toMatchObject({
      code: RimeError.NOT_FOUND
    });
    expect(pages.updateWhere).not.toHaveBeenCalled();
  });
});
