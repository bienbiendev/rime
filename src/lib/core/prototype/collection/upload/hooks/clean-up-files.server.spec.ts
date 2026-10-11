import { text } from '#lib/fields/text/index.js';
import type { Dic } from '#lib/util/types.js';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mediaFilePath } from '../disk/medias.server.js';
import { cleanUpFiles, collectFiles } from './clean-up-files.server.js';

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'rime-medias-'));
  mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Its files, and its versions', live in storage/uploads/medias
const config = {
  slug: 'medias',
  kebab: 'medias',
  _versions: { slug: 'medias_versions' },
  upload: {},
  fields: []
};
const versions = {
  slug: 'medias_versions',
  kebab: 'medias-versions',
  upload: {},
  fields: [text('filename')],
  _shadowOf: 'medias'
};

const put = (...names: string[]) =>
  names.forEach((name) => writeFileSync(mediaFilePath(config, name), name));
const onDisk = (name: string) => existsSync(mediaFilePath(config, name));

test('a deleted document takes the files of all its versions, and leaves a shared one', async () => {
  put('a.jpg', 'b.jpg', 'b-thumbnail-400.jpg', 'shared.jpg');

  // The versions table: three rows of `doc`, one row of another document
  let rows: Dic[] = [
    { id: 'v1', ownerId: 'doc', filename: 'a.jpg' },
    { id: 'v2', ownerId: 'doc', filename: 'a.jpg' },
    {
      id: 'v3',
      ownerId: 'doc',
      filename: 'b.jpg',
      sizes: { thumbnail: '/uploads/medias/b-thumbnail-400.jpg' }
    },
    { id: 'v4', ownerId: 'doc', filename: 'shared.jpg' },
    { id: 'w1', ownerId: 'other', filename: 'shared.jpg' }
  ];
  const find = async ({ query }: { query: any }) =>
    typeof query === 'string'
      ? rows.filter((row) => query.endsWith(`=${encodeURIComponent(row.filename)}`))
      : rows.filter((row) => row.ownerId === query.where.ownerId.equals);

  const rime = {
    config: {
      collections: { medias: config, medias_versions: versions },
      getCollection: () => config,
      getLocalesCodes: () => []
    },
    collection: () => ({ system: () => ({ find }) })
  };
  const args = {
    config,
    event: { locals: { rime } },
    operation: 'delete',
    doc: { id: 'doc' },
    context: { params: { id: 'doc' } }
  } as any;

  const before = await collectFiles(args);
  expect(['a.jpg', 'b.jpg', 'b-thumbnail-400.jpg'].every(onDisk)).toBe(true);

  // The rows go by cascade
  rows = rows.filter((row) => row.ownerId !== 'doc');
  await cleanUpFiles({ ...args, context: before.context });

  expect(onDisk('a.jpg')).toBe(false);
  expect(onDisk('b.jpg')).toBe(false);
  expect(onDisk('b-thumbnail-400.jpg')).toBe(false);
  expect(onDisk('shared.jpg')).toBe(true);
});
