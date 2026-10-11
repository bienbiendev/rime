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
});
