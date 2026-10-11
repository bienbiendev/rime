import type { Dic } from '#lib/util/types.js';
import { expect, test } from 'vitest';
import { handlePathCreation } from './handle-path-creation.server.js';

/**
 * A directories collection held in memory. `create` refuses an id that exists, as the unique
 * column does, and `beforeCreate` runs first, to stand for another request or a failed check.
 */
const directories = (beforeCreate: (id: string, rows: Map<string, Dic>) => void = () => {}) => {
  const rows = new Map<string, Dic>();
  const collection = {
    findById: async ({ id }: { id: string }) => rows.get(id) ?? null,
    create: async ({ data }: { data: Dic }) => {
      beforeCreate(data.id, rows);
      if (rows.has(data.id)) throw new Error(`UNIQUE constraint failed: ${data.id}`);
      rows.set(data.id, data);
      return data;
    }
  };
  const rime = { collection: () => ({ system: () => collection }) };
  return { rows, rime };
};

const upload = (rime: unknown, _path: string) =>
  ({
    config: { slug: 'medias' },
    event: { locals: { rime } },
    operation: 'create',
    data: { _path }
  }) as any;

test('a folder another request creates in the meantime keeps the path asked for', async () => {
  // Another upload creates root:a between this one's read and its create
  const { rows, rime } = directories((id, rows) => {
    if (id === 'root:a' && !rows.has(id)) rows.set(id, { id });
  });

  const args = await handlePathCreation(upload(rime, 'root:a:c'));

  expect(args.data._path).toBe('root:a:c');
  expect([...rows.keys()]).toEqual(['root', 'root:a', 'root:a:c']);
});

test('a folder that cannot be created fails the upload with its error', async () => {
  const required = new Error('name: required');
  const { rime } = directories((id) => {
    if (id === 'root:a') throw required;
  });

  await expect(handlePathCreation(upload(rime, 'root:a:b'))).rejects.toBe(required);
});
