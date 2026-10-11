import { RimeError } from '#lib/core/errors/index.js';
import type { Dic } from '#lib/util/types.js';
import { describe, expect, it } from 'vitest';
import { preventLastVersionDeletion } from './prevent-last-version-deletion.server.js';

/** A row matches `{ field: { equals } }`, `{ field: { not_equals } }` and an `and` of them. */
const matches = (row: Dic, where: Dic): boolean =>
  Object.entries(where).every(([key, value]) =>
    key === 'and'
      ? (value as Dic[]).every((one) => matches(row, one))
      : 'equals' in value
        ? row[key] === value.equals
        : row[key] !== value.not_equals
  );

/** Deletes `doc` from a versions table holding `rows`. */
const remove = (doc: Dic, rows: Dic[]) =>
  preventLastVersionDeletion({
    config: { slug: 'news__versions' },
    doc,
    event: {
      locals: {
        rime: {
          adapter: {
            collection: () => ({
              findMany: async ({ query }: { query: { where: Dic } }) =>
                rows.filter((row) => matches(row, query.where))
            })
          }
        }
      }
    },
    context: {}
  } as any);

const refused = expect.objectContaining({ code: RimeError.BAD_REQUEST });

describe('preventLastVersionDeletion', () => {
  const v1 = { id: 'v1', ownerId: 'n1', isAutoSave: false };
  const v2 = { id: 'v2', ownerId: 'n1', isAutoSave: false };
  const a1 = { id: 'a1', ownerId: 'n1', isAutoSave: true };

  it('refuses the last version when an auto-save is all that stays', async () => {
    await expect(remove(v1, [v1, a1])).rejects.toEqual(refused);
  });

  it('lets a version go beside another version', async () => {
    await expect(remove(v1, [v1, v2, a1])).resolves.toBeDefined();
  });

  it('lets an auto-save go, even the only row left', async () => {
    await expect(remove(a1, [a1])).resolves.toBeDefined();
  });

  it('counts every row of a table without auto-save', async () => {
    const plain = { id: 'p1', ownerId: 'n2' };
    await expect(remove(plain, [plain])).rejects.toEqual(refused);
    await expect(remove(plain, [plain, { id: 'p2', ownerId: 'n2' }])).resolves.toBeDefined();
  });
});
