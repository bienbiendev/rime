import { describe, expect, test, vi } from 'vitest';

vi.mock('$app/state', () => ({ page: { params: { panel: 'panel' } } }));
vi.mock('$app/env/public', () => ({ SITE_URL: 'https://site.com' }));

const { createPath, documentSegments, withLocale } = await import('./url.js');

describe('panel URLs', () => {
  test('the create path opens an upload collection in a folder, the root by default', () => {
    expect(createPath({ kebab: 'pages' })).toBe('/panel/pages/create');
    expect(createPath({ kebab: 'medias', upload: {} })).toBe(
      '/panel/medias/create?uploadPath=root'
    );
    expect(createPath({ kebab: 'medias', upload: {} }, 'root:a')).toBe(
      '/panel/medias/create?uploadPath=root:a'
    );
  });

  test('a document is its kebab and id, an area its kebab alone', () => {
    expect(documentSegments('pages', { _prototype: 'collection', id: 'a1' })).toEqual([
      'pages',
      'a1'
    ]);
    expect(documentSegments('pages', { _prototype: 'collection' })).toEqual(['pages']);
    expect(documentSegments('settings', { _prototype: 'area', id: 's1' })).toEqual(['settings']);
  });

  test('a url names the locale once, and keeps the rest as written', () => {
    expect(withLocale('/api/pages?limit=5', 'fr')).toBe('/api/pages?limit=5&locale=fr');
    expect(withLocale('/api/pages?locale=en', 'fr')).toBe('/api/pages?locale=en');
    expect(withLocale('/api/pages', 'fr')).toBe('/api/pages?locale=fr');
    expect(withLocale('/api/pages', undefined)).toBe('/api/pages');
  });
});
