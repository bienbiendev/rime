import { describe, expect, test } from 'vitest';
import { updateDirectoryChildren } from './update-directory-children.server.js';

describe('updateDirectoryChildren', () => {
  test('a child that cannot move names itself and keeps its cause', async () => {
    const rime = {
      collection: () => ({
        system: () => ({
          updateById: async () => {
            throw new Error('form_error — label: Required');
          }
        })
      })
    };

    const run = updateDirectoryChildren({
      config: { slug: '$mediasDirectories' },
      event: { locals: { rime } },
      data: {},
      doc: { id: 'root:b:a' },
      context: { directoriesUpdates: [{ id: 'root:a:x', data: { id: 'root:b:a:x' } }] }
    } as any);

    await expect(run).rejects.toThrow(
      'Error when moving child directory root:a:x: form_error — label: Required'
    );
  });
});
