import { beforeEach, describe, expect, test, vi } from 'vitest';

/** The files on disk, by name. */
const { existing } = vi.hoisted(() => ({ existing: new Set<string>() }));
vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: (file: string) => existing.has(file.split('/').pop()!)
}));

const { sizeFileName, checkImageSizesExist } = await import('./save.server.js');

// Each test starts on an empty disk
beforeEach(() => existing.clear());

describe('sizeFileName', () => {
  test('names the dimensions a size has', () => {
    expect(sizeFileName('photo', { name: 'thumbnail', width: 400 }, 'jpg')).toBe(
      'photo-thumbnail-400.jpg'
    );
    expect(sizeFileName('photo', { name: 'card', width: 800, height: 600 }, 'webp')).toBe(
      'photo-card-800x600.webp'
    );
    expect(sizeFileName('photo', { name: 'tall', height: 900 }, 'jpg')).toBe('photo-tall-900.jpg');
  });
});

describe('checkImageSizesExist', () => {
  const medias = { kebab: 'medias' };

  test('finds a width-only size written by generateSizes', () => {
    existing.add('photo-thumbnail-400.jpg');
    expect(
      checkImageSizesExist(medias, 'photo', 'jpg', [{ name: 'thumbnail', width: 400 }])
    ).toEqual({ thumbnail: 'photo-thumbnail-400.jpg' });
  });

  test('answers nothing when a size is missing', () => {
    expect(checkImageSizesExist(medias, 'photo', 'jpg', [{ name: 'card', width: 800 }])).toEqual(
      {}
    );
  });

  test('finds every format of a size with several', () => {
    existing.add('photo-hero-800.jpg');
    existing.add('photo-hero-800.webp');
    expect(
      checkImageSizesExist(medias, 'photo', 'jpg', [
        { name: 'hero', width: 800, out: ['jpg', 'webp'] }
      ])
    ).toEqual({ hero: 'photo-hero-800.jpg|photo-hero-800.webp' });
  });

  test('answers nothing when one format of a size is missing', () => {
    existing.add('photo-hero-800.jpg');
    expect(
      checkImageSizesExist(medias, 'photo', 'jpg', [
        { name: 'hero', width: 800, out: ['jpg', 'webp'] }
      ])
    ).toEqual({});
  });
});
