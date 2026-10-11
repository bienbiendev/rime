import { expect, test } from 'vitest';
import { populateSizes } from './populate-sizes.server.js';

/** `doc` as a read of a collection with `imageSizes` answers it. */
const read = (doc: object, imageSizes: object[], config: object = {}) =>
  populateSizes({
    doc,
    config: { kebab: 'medias', upload: { imageSizes }, ...config },
    event: { locals: { rime: { config: { getCollection: () => ({ kebab: 'medias' }) } } } },
    context: { params: {} }
  } as any);

test('names one key per format, and takes the thumbnail', async () => {
  const { doc } = await read(
    { filename: 'a.jpg', thumbnail: 'a-thumbnail-400.jpg', hero: 'a-hero-800.jpg|a-hero-800.webp' },
    [
      { name: 'thumbnail', width: 400 },
      { name: 'hero', width: 800, out: ['jpg', 'webp'] }
    ]
  );
  expect(doc.sizes).toEqual({
    thumbnail: '/uploads/medias/a-thumbnail-400.jpg',
    hero_jpg: '/uploads/medias/a-hero-800.jpg',
    hero_webp: '/uploads/medias/a-hero-800.webp'
  });
  expect(doc._thumbnail).toBe('/uploads/medias/a-thumbnail-400.jpg');
  expect(doc.url).toBe('/uploads/medias/a.jpg');
  // The size columns are read into `sizes` only
  expect(doc).not.toHaveProperty('hero');
});

test('points a size never generated at the file itself', async () => {
  const { doc } = await read({ filename: 'a.pdf' }, [{ name: 'thumbnail', width: 400 }]);
  expect(doc.sizes).toEqual({ thumbnail: '/uploads/medias/a.pdf' });
  expect(doc._thumbnail).toBe('/uploads/medias/a.pdf');
});

test('gives a document with no file no url', async () => {
  const { doc } = await read({ filename: null }, [{ name: 'thumbnail', width: 400 }]);
  expect(doc.url).toBeNull();
  expect(doc).not.toHaveProperty('sizes');
});

test('serves the files from the folder the collection names', async () => {
  const { doc } = await read(
    { filename: 'a.jpg', thumbnail: 'a-thumbnail-400.jpg' },
    [{ name: 'thumbnail', width: 400 }],
    { kebab: 'private-medias', upload: { folder: 'invoices', imageSizes: [{ name: 'thumbnail' }] } }
  );
  expect(doc.url).toBe('/uploads/invoices/a.jpg');
  expect(doc.sizes).toEqual({ thumbnail: '/uploads/invoices/a-thumbnail-400.jpg' });
});

test('serves the files of a versions collection from its document folder', async () => {
  const versions = { kebab: 'medias--versions', _shadowOf: 'medias' };
  const { doc } = await read({ filename: 'a.jpg' }, [{ name: 'thumbnail', width: 400 }], versions);
  expect(doc.url).toBe('/uploads/medias/a.jpg');
});
