import { authorize } from '#lib/core/pipeline/hooks/authorize.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import { MAX_DEPTH } from '#lib/core/constants.js';
import { relation, text } from '#lib/fields/index.js';
import { expect, test, vi } from 'vitest';
import { find } from './find.js';

/**
 * A collection anyone reads, whose `draftNote` only staff read. The adapter answers `rows`, each
 * written by the staff member `s1`, and the related reads answer nothing.
 */
const setup = (options: { isSystemOperation?: boolean; rows?: { id: string }[] } = {}) => {
  const findMany = vi.fn(async () => options.rows ?? []);
  const findByIds = vi.fn<(args: { depth: number }) => Promise<[]>>(async () => []);
  const related = { findByIds, system: () => related };
  const config = {
    slug: 'notices',
    fields: [
      text('title'),
      text('draftNote').access({ read: (user: any) => !!user?.isStaff }),
      relation('author').to('staff')
    ],
    access: { read: () => true },
    $hooks: { beforeOperation: [authorize] }
  };
  const event = {
    params: {},
    locals: {
      user: undefined,
      rime: {
        adapter: {
          collection: () => ({ findMany }),
          transform: {
            rows: async ({ doc }: any) => ({
              base: doc,
              blocks: [],
              tree: [],
              relations: [{ relationTo: 'staff', documentId: 's1', path: 'author', position: 0 }]
            })
          }
        },
        collection: () => related
      }
    }
  };
  const ctx = {
    config,
    event,
    isSystemOperation: !!options.isSystemOperation,
    versionQuery: () => undefined
  };
  return { ctx: ctx as any, findMany, findByIds };
};

const refused = expect.objectContaining({ code: RimeError.UNAUTHORIZED });

test('a filter or a sort on a field the reader may not read is refused before the query', async () => {
  const { ctx, findMany } = setup();

  await expect(find({ ctx, query: 'where[draftNote][like]=a%25' })).rejects.toThrowError(refused);
  await expect(find({ ctx, sort: '-draftNote' })).rejects.toThrowError(refused);
  expect(findMany).not.toHaveBeenCalled();
});

test('a system read filters and sorts on any field', async () => {
  const { ctx, findMany } = setup({ isSystemOperation: true });

  await find({ ctx, query: 'where[draftNote][like]=a%25', sort: 'draftNote' });
  expect(findMany).toHaveBeenCalledOnce();
});

test('a read asking more than MAX_DEPTH levels resolves MAX_DEPTH', async () => {
  const { ctx, findByIds } = setup({ rows: [{ id: 'n1' }] });

  await find({ ctx, depth: 50 });
  expect(findByIds).toHaveBeenCalledOnce();
  expect(findByIds.mock.calls[0][0].depth).toBe(MAX_DEPTH - 1);
});
