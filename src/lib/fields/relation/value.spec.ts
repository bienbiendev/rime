import { describe, expect, it } from 'vitest';
import { toRelationValue } from './value.js';

describe('toRelationValue', () => {
  it('writes one relation per document, positioned by order', () => {
    expect(
      toRelationValue([{ documentId: 'a' }, { documentId: 'b', id: 'r1' }], {
        relationTo: 'medias',
        path: 'photos'
      })
    ).toEqual([
      { id: undefined, relationTo: 'medias', path: 'photos', position: 0, documentId: 'a' },
      { id: 'r1', relationTo: 'medias', path: 'photos', position: 1, documentId: 'b' }
    ]);
  });

  it('adds the locale, and the live preview in a live form only', () => {
    const livePreview = { id: 'a' } as never;
    const [localized] = toRelationValue([{ documentId: 'a', livePreview }], {
      relationTo: 'medias',
      path: 'photos',
      locale: 'fr'
    });
    expect(localized.locale).toBe('fr');
    expect(localized.livePreview).toBeUndefined();

    const [live] = toRelationValue([{ documentId: 'a', livePreview }], {
      relationTo: 'medias',
      path: 'photos',
      live: true
    });
    expect(live.livePreview).toBe(livePreview);
  });
});
