import { text } from '#lib/fields/text/index.js';
import type { Dic } from '#lib/util/types.js';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { removeUnusedFiles, rowFiles } from './delete.server.js';
import { mediaFilePath } from './medias.server.js';

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'rime-medias-'));
  mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
  mkdirSync(join(root, 'storage/uploads/private-medias'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Two collections, each with a folder of its own
const medias = { slug: 'medias', kebab: 'medias', upload: {}, fields: [text('filename')] } as any;
const privateMedias = { ...medias, slug: 'privateMedias', kebab: 'private-medias' };

const put = (...names: string[]) =>
  names.forEach((name) => writeFileSync(mediaFilePath(medias, name), name));
const onDisk = (name: string) => existsSync(mediaFilePath(medias, name));

/** A rime with two upload collections; `rows` are the rows of `medias`. */
const rimeWith = (rows: Dic[]) =>
  ({
    config: {
      collections: { medias, privateMedias },
      getLocalesCodes: () => []
    },
    collection: (slug: string) => ({
      system: () => ({
        find: async ({ query }: { query: string }) =>
          slug === 'medias'
            ? rows.filter((row) => query.endsWith(`=${encodeURIComponent(row.filename)}`))
            : []
      })
    })
  }) as any;

describe('rowFiles', () => {
  test('names the file of a row and each of its sizes once', () => {
    const doc = {
      filename: 'a.jpg',
      sizes: { thumbnail: '/uploads/medias/a-thumbnail-400.jpg', card: '/uploads/medias/a.jpg' }
    };
    expect(rowFiles(doc)).toEqual({ filename: 'a.jpg', files: ['a.jpg', 'a-thumbnail-400.jpg'] });
  });

  test('is null for a row with no file', () => {
    expect(rowFiles({ filename: null })).toBeNull();
    expect(rowFiles(undefined)).toBeNull();
  });
});

describe('removeUnusedFiles', () => {
  const stored = [{ filename: 'a.jpg', files: ['a.jpg', 'a-thumbnail-400.jpg'] }];

  test('deletes a file no row names, and its sizes', async () => {
    put('a.jpg', 'a-thumbnail-400.jpg');
    await removeUnusedFiles({ rime: rimeWith([]), config: medias, stored });
    expect(onDisk('a.jpg')).toBe(false);
    expect(onDisk('a-thumbnail-400.jpg')).toBe(false);
  });

  test('keeps a file a row still names', async () => {
    put('a.jpg', 'a-thumbnail-400.jpg');
    const rime = rimeWith([{ id: 'd2', filename: 'a.jpg' }]);
    await removeUnusedFiles({ rime, config: medias, stored });
    expect(onDisk('a.jpg')).toBe(true);
    expect(onDisk('a-thumbnail-400.jpg')).toBe(true);
  });

  test('deletes the file of its own folder, whatever a row of another collection names', async () => {
    put('a.jpg');
    writeFileSync(mediaFilePath(privateMedias, 'a.jpg'), 'a.jpg');
    const rime = rimeWith([{ id: 'd2', filename: 'a.jpg' }]);

    await removeUnusedFiles({ rime, config: privateMedias, stored });

    expect(existsSync(mediaFilePath(privateMedias, 'a.jpg'))).toBe(false);
    expect(onDisk('a.jpg')).toBe(true);
  });

  test('deletes the sizes of a file already gone', async () => {
    put('a-thumbnail-400.jpg');
    await removeUnusedFiles({ rime: rimeWith([]), config: medias, stored });
    expect(onDisk('a-thumbnail-400.jpg')).toBe(false);
  });

  test('deletes the size files of every row naming the file', async () => {
    put('a.jpg', 'a-thumbnail-400.jpg', 'a-thumbnail-400.webp');
    const rows = [
      { filename: 'a.jpg', files: ['a.jpg', 'a-thumbnail-400.jpg'] },
      { filename: 'a.jpg', files: ['a.jpg', 'a-thumbnail-400.webp'] }
    ];
    await removeUnusedFiles({ rime: rimeWith([]), config: medias, stored: rows });
    expect(['a.jpg', 'a-thumbnail-400.jpg', 'a-thumbnail-400.webp'].some(onDisk)).toBe(false);
  });

  test('deletes nothing outside the folder, whatever a row names', async () => {
    const env = join(process.cwd(), '.env');
    writeFileSync(env, 'SECRET=1');
    const doc = {
      filename: '../../../.env',
      sizes: { thumbnail: '/uploads/medias/../../../.env' }
    };

    await removeUnusedFiles({ rime: rimeWith([]), config: medias, stored: [rowFiles(doc)!] });

    expect(existsSync(env)).toBe(true);
  });
});
