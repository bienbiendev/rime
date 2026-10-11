import { describe, expect, test } from 'vitest';
import { fileNameAndExt, fileSizeToString, joinFileName, normalizeFileName } from './file.js';

describe('file names', () => {
  test('a name with no dot, or with its only dot first, has no extension', () => {
    expect(fileNameAndExt('README')).toEqual({ name: 'README', extension: '' });
    expect(fileNameAndExt('.env')).toEqual({ name: '.env', extension: '' });
    expect(fileNameAndExt('image.with.dots.JPG')).toEqual({
      name: 'image.with.dots',
      extension: 'jpg'
    });
  });

  test('a name without extension is joined without a dot', () => {
    expect(joinFileName('readme', '')).toBe('readme');
    expect(joinFileName('photo', 'jpg')).toBe('photo.jpg');
  });

  test('README is normalized to readme, with no extension', () => {
    const { name, extension } = normalizeFileName('README');
    expect(joinFileName(name, extension)).toBe('readme');
  });

  test('a name with nothing left after the slug is named file', () => {
    expect(normalizeFileName('日本.jpg')).toEqual({ name: 'file', extension: 'jpg' });
    expect(normalizeFileName('写 真.JPEG')).toEqual({ name: 'file', extension: 'jpg' });
    expect(normalizeFileName('Été 2024.png')).toEqual({ name: 'ete-2024', extension: 'png' });
  });
});

describe('fileSizeToString', () => {
  test('a size that rounds to 1000 of a unit reads in the next one, up to GB', () => {
    expect(fileSizeToString(500)).toBe('0.50KB');
    expect(fileSizeToString(999_999)).toBe('1.00MB');
    expect(fileSizeToString(3_200_000)).toBe('3.20MB');
    expect(fileSizeToString(2_500_000_000)).toBe('2.50GB');
  });
});
