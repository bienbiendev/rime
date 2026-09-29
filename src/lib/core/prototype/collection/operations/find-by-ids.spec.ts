import { authorize } from '$lib/core/pipeline/hooks/authorize.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { expect, test, vi } from 'vitest';
import { findByIds } from './find-by-ids.js';

/**
 * A collection whose read rule looks at the id, over an adapter that answers every id asked for.
 * `beforeOperation` defaults to the real authorize.
 */
const setup = (options: { beforeOperation?: unknown[] } = {}) => {
  const findMany = vi.fn(async (args: any) =>
    (args.query.where.id.in_array as string[]).map((id) => ({ id }))
  );
  const config = {
    slug: 'pages',
    fields: [],
    access: { read: (_user: unknown, { id }: { id?: string }) => id !== 'secret' },
    $hooks: { beforeOperation: options.beforeOperation ?? [authorize] }
  };
  const event = {
    params: {},
    locals: {
      user: undefined,
      rime: {
        adapter: {
          collection: () => ({ findMany }),
          transform: {
            rows: async ({ doc }: any) => ({ base: doc, blocks: [], tree: [], relations: [] })
          }
        },
        config: { isCollection: () => true },
        collection: () => ({ blank: () => ({}) })
      }
    }
  };
  const ctx = { config, event, isSystemOperation: false, versionQuery: () => undefined };
  return { ctx: ctx as any, findMany };
};

test('the read rule answers for each id: a refused one is left out, before the query', async () => {
  const { ctx, findMany } = setup();

  const docs = await findByIds({ ctx, ids: ['a', 'secret', 'b'] });

  expect(docs.map((doc) => doc.id)).toEqual(['a', 'b']);
  expect(findMany.mock.calls[0][0].query).toEqual({ where: { id: { in_array: ['a', 'b'] } } });
});

test('nothing readable, nothing queried', async () => {
  const { ctx, findMany } = setup();

  expect(await findByIds({ ctx, ids: ['secret'] })).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
});

test('an error other than a refusal is thrown', async () => {
  const failing = async () => {
    throw new RimeError(RimeError.INVALID_DATA, 'broken hook');
  };
  const { ctx } = setup({ beforeOperation: [failing] });

  await expect(findByIds({ ctx, ids: ['a'] })).rejects.toThrow('broken hook');
});
