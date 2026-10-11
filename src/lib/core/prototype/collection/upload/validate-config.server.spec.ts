import { describe, expect, test } from 'vitest';
import { validateUploads } from './validate-config.server.js';

/** An upload collection, as the config check reads it. */
const upload = (slug: string, kebab: string, folder?: string) =>
  ({ slug, kebab, upload: folder ? { folder } : {} }) as any;

describe('validateUploads', () => {
  test('a folder of its own, or the kebab, is accepted', () => {
    expect(
      validateUploads([upload('medias', 'medias'), upload('docs', 'docs', 'press-kit')])
    ).toEqual([]);
  });

  test('a folder that is not one lowercase segment is refused', () => {
    for (const folder of ['Docs', 'docs/2026', '../docs', '-docs', 'docs_2026']) {
      const errors = validateUploads([upload('docs', 'docs', folder)]);
      expect(errors).toEqual([expect.stringContaining(`Upload folder "${folder}"`)]);
    }
  });

  test('two collections in the same folder are refused', () => {
    const errors = validateUploads([upload('medias', 'medias'), upload('docs', 'docs', 'medias')]);
    expect(errors).toEqual([expect.stringContaining('used by both medias and docs')]);
  });

  test('a versions collection shares its document folder, and a plain collection has none', () => {
    const versions = {
      ...upload('$medias__versions', 'medias--versions', 'medias'),
      _shadowOf: 'medias'
    };
    const pages = { slug: 'pages', kebab: 'medias' } as any;
    expect(validateUploads([upload('medias', 'medias'), versions, pages])).toEqual([]);
  });
});
