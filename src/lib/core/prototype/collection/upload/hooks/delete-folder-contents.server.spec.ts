import { describe, expect, test } from 'vitest';
import { deleteFolderContents } from './delete-folder-contents.server.js';

describe('deleteFolderContents', () => {
  test('deletes the sub-folders, then the documents filed in the folder, as rime', async () => {
    const deletes: [string, unknown][] = [];
    const rime = {
      config: {
        raw: {
          collections: [
            { slug: 'medias', upload: {} },
            { slug: '$mediasVersions', upload: {}, _shadowOf: 'medias' },
            { slug: 'pages' }
          ]
        }
      },
      collection: (slug: string) => ({
        system: () => ({
          delete: async (args: { query: unknown }) => {
            deletes.push([slug, args.query]);
            return [];
          }
        })
      })
    };

    await deleteFolderContents({
      config: { slug: '$mediasDirectories' },
      doc: { id: 'root:press' },
      event: { locals: { rime } }
    } as any);

    expect(deletes).toEqual([
      ['$mediasDirectories', { where: { parent: { equals: 'root:press' } } }],
      ['medias', { where: { _path: { equals: 'root:press' } } }]
    ]);
  });
});
