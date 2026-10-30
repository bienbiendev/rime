import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { addChildrenProperty } from './add-children.server.js';

/** The `content` filter the children of `p1` are read with, in a drafts collection, for `user`. */
const childrenRead = async (args: { user?: Dic; system?: boolean }) => {
  const findMany = vi.fn(async () => [{ id: 'c1' }]);
  await addChildrenProperty({
    config: { slug: 'pages', versions: { draft: true, autoSave: false } },
    doc: { id: 'p1' },
    event: { locals: { user: args.user, rime: { adapter: { collection: () => ({ findMany }) } } } },
    context: { params: {}, isSystemOperation: args.system }
  } as any);
  return (findMany.mock.calls[0] as Dic[])[0].content;
};

describe('addChildrenProperty', () => {
  it('lists the published children to a reader who is not staff', async () => {
    expect(await childrenRead({ user: undefined })).toEqual({
      where: { status: { equals: 'published' } }
    });
  });

  it('lists every real child to staff and to rime', async () => {
    expect(await childrenRead({ user: { id: 's1', isStaff: true } })).toBeUndefined();
    expect(await childrenRead({ system: true })).toBeUndefined();
  });

  it('reads the children of a whole list once, each document taking its own', async () => {
    const findMany = vi.fn(async () => [
      { id: 'c1', _parent: 'p2' },
      { id: 'c2', _parent: 'p1' },
      { id: 'c3', _parent: 'p2' }
    ]);
    const docs = [{ id: 'p1' }, { id: 'p2' }];
    const context = { params: {}, list: { docs, reads: new Map() } };
    const [p1, p2] = await Promise.all(
      docs.map((doc) =>
        addChildrenProperty({
          config: { slug: 'pages' },
          doc,
          event: { locals: { rime: { adapter: { collection: () => ({ findMany }) } } } },
          context
        } as any)
      )
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    expect((findMany.mock.calls[0] as Dic[])[0].query).toEqual({
      where: { _parent: { in_array: ['p1', 'p2'] } }
    });
    expect(p1.doc._children).toEqual(['c2']);
    expect(p2.doc._children).toEqual(['c1', 'c3']);
  });
});
