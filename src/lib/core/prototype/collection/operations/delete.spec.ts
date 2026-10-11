import { authorize } from '#lib/core/pipeline/hooks/authorize.server.js';
import { RimeError } from '#lib/core/errors/index.js';
import { text } from '#lib/fields/index.js';
import { expect, test, vi } from 'vitest';
import { deleteDocs } from './delete.js';

test('a delete filtered on a field the reader may not read is refused before the query', async () => {
  const findMany = vi.fn(async () => []);
  const config = {
    slug: 'notices',
    fields: [text('title'), text('draftNote').access({ read: (user: any) => !!user?.isStaff })],
    access: { delete: () => true },
    $hooks: { beforeOperation: [authorize] }
  };
  const event = {
    params: {},
    locals: {
      user: undefined,
      rime: { adapter: { collection: () => ({ findMany }) }, collection: () => ({}) }
    }
  };
  const ctx = { config, event, isSystemOperation: false } as any;

  await expect(deleteDocs({ ctx, query: 'where[draftNote][like]=a%25' })).rejects.toThrowError(
    expect.objectContaining({ code: RimeError.UNAUTHORIZED })
  );
  expect(findMany).not.toHaveBeenCalled();
});

test('a row the caller may not delete stays, the others go, and the answer lists what went', async () => {
  const deleteById = vi.fn(async ({ id }: { id: string }) => {
    if (id === 'admin') throw new RimeError(RimeError.UNAUTHORIZED);
    return id;
  });
  const event = {
    params: {},
    locals: {
      user: { id: 's1' },
      rime: {
        adapter: {
          collection: () => ({
            findMany: async () => [{ id: 'a' }, { id: 'admin' }, { id: 'b' }]
          })
        },
        collection: () => ({ deleteById })
      }
    }
  };
  const ctx = { config: { slug: 'staff', fields: [], $hooks: {} }, event } as any;

  expect(await deleteDocs({ ctx })).toEqual(['a', 'b']);
  expect(deleteById).toHaveBeenCalledTimes(3);
});

test('an error other than a refusal still fails the delete', async () => {
  const event = {
    params: {},
    locals: {
      user: { id: 's1' },
      rime: {
        adapter: { collection: () => ({ findMany: async () => [{ id: 'a' }] }) },
        collection: () => ({
          deleteById: async () => {
            throw new Error('database is locked');
          }
        })
      }
    }
  };
  const ctx = { config: { slug: 'staff', fields: [], $hooks: {} }, event } as any;

  await expect(deleteDocs({ ctx })).rejects.toThrow('database is locked');
});
