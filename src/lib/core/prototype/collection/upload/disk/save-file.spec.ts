import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mediaFilePath } from './medias.server.js';
import { saveFile } from './save.server.js';

// Each test writes to a medias folder of its own
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'rime-medias-'));
  mkdirSync(join(root, 'storage/uploads/medias'), { recursive: true });
  mkdirSync(join(root, 'storage/uploads/private-medias'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A 2×2 PNG of one colour, as an uploaded file. */
const png = async (name: string, colour: string) => {
  const buffer = await sharp({
    create: { width: 2, height: 2, channels: 3, background: colour }
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], name, { type: 'image/png' });
};

const medias = { kebab: 'medias' };
const privateMedias = { kebab: 'private-medias' };

test('reuses an identical file and renames a different one', async () => {
  expect((await saveFile(medias, await png('a.png', 'red'), false)).filename).toBe('a.png');
  expect((await saveFile(medias, await png('a.png', 'red'), false)).filename).toBe('a.png');
  expect((await saveFile(medias, await png('a.png', 'blue'), false)).filename).toMatch(
    /^a-\d+\.png$/
  );
});

test('reuses a file of its own folder only', async () => {
  await saveFile(medias, await png('a.png', 'red'), false);
  expect((await saveFile(privateMedias, await png('a.png', 'red'), false)).filename).toBe('a.png');
  expect(existsSync(mediaFilePath(privateMedias, 'a.png'))).toBe(true);
});

test('writes each size in each format', async () => {
  const { imageSizes } = await saveFile(medias, await png('b.png', 'red'), [
    { name: 'hero', width: 1, out: ['jpg', 'webp'] }
  ]);
  expect(imageSizes).toEqual({ hero: 'b-hero-1.jpg|b-hero-1.webp' });
  expect(existsSync(mediaFilePath(medias, 'b-hero-1.jpg'))).toBe(true);
  expect(existsSync(mediaFilePath(medias, 'b-hero-1.webp'))).toBe(true);
});
