import type { Dic } from '#lib/util/types.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { moveUploads } from './uploads-move.server.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rime-uploads-'));
  mkdirSync(join(root, 'static/medias'), { recursive: true });
  for (const name of ['a.jpg', 'a-thumbnail-400.jpg', 'a-hero-800.webp', 'b.pdf', 'shared.jpg']) {
    writeFileSync(join(root, 'static/medias', name), name);
  }
  writeFileSync(join(root, 'static/medias', 'orphan.jpg'), 'orphan');
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// `medias` keeps its rows on its versions table; `docs` names its own folder
const medias = {
  slug: 'medias',
  kebab: 'medias',
  _versions: { slug: 'medias_versions' },
  upload: { imageSizes: [{ name: 'thumbnail' }, { name: 'hero' }] }
};
const versions = {
  slug: 'medias_versions',
  kebab: 'medias-versions',
  upload: medias.upload,
  _shadowOf: 'medias'
};
const docs = { slug: 'docs', kebab: 'docs', upload: { folder: 'press' } };
const pages = { slug: 'pages', kebab: 'pages' };

const rows: Record<string, Dic[]> = {
  medias_versions: [
    { filename: 'a.jpg', thumbnail: 'a-thumbnail-400.jpg', hero: 'a-hero-800.webp|a-hero-800.jpg' },
    { filename: 'shared.jpg' }
  ],
  docs: [{ filename: 'b.pdf' }, { filename: 'shared.jpg' }]
};

const rime = {
  config: { raw: { collections: [medias, versions, docs, pages] } },
  adapter: { collection: (slug: string) => ({ findMany: async () => rows[slug] ?? [] }) }
} as any;

const at = (file: string) => join(root, file);

test("moves each file a row names to its collection's folder, and lists the others", async () => {
  const { moved, unreferenced } = await moveUploads(rime);

  for (const name of ['a.jpg', 'a-thumbnail-400.jpg', 'a-hero-800.webp']) {
    expect(existsSync(at(`storage/uploads/medias/${name}`))).toBe(true);
    expect(existsSync(at(`static/medias/${name}`))).toBe(false);
  }
  expect(readFileSync(at('storage/uploads/press/b.pdf'), 'utf8')).toBe('b.pdf');
  // A file two collections name goes to both folders
  expect(existsSync(at('storage/uploads/medias/shared.jpg'))).toBe(true);
  expect(existsSync(at('storage/uploads/press/shared.jpg'))).toBe(true);
  // A size named but never written is skipped
  expect(existsSync(at('storage/uploads/medias/a-hero-800.jpg'))).toBe(false);

  expect(moved).toBe(5);
  expect(unreferenced).toEqual(['orphan.jpg']);
  expect(existsSync(at('static/medias/orphan.jpg'))).toBe(true);
});

test('a second run moves nothing', async () => {
  await moveUploads(rime);
  const { moved, unreferenced } = await moveUploads(rime);
  expect(moved).toBe(0);
  expect(unreferenced).toEqual(['orphan.jpg']);
  expect(readFileSync(at('storage/uploads/medias/a.jpg'), 'utf8')).toBe('a.jpg');
});
