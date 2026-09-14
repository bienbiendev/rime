import { describe, expect, it } from 'vitest';
import { localeOrder, mergeLocaleRows } from './locales.server.js';

const ctx = (localization?: object) =>
  ({
    raw: { localization },
    getLocalesCodes: () =>
      localization
        ? (localization as { locales: { code: string }[] }).locales.map((l) => l.code)
        : []
  }) as never;

const trilingual = {
  locales: [{ code: 'fr' }, { code: 'en' }, { code: 'de' }],
  default: 'en'
};

describe('localeOrder', () => {
  it('reads the requested locale, then the default, then the rest in config order', () => {
    expect(localeOrder(ctx(trilingual), 'de')).toEqual(['de', 'en', 'fr']);
    expect(localeOrder(ctx(trilingual), 'en')).toEqual(['en', 'fr', 'de']);
  });

  it('is the requested locale alone when fallback is off, by config or by the caller', () => {
    expect(localeOrder(ctx({ ...trilingual, fallback: false }), 'de')).toEqual(['de']);
    expect(localeOrder(ctx(trilingual), 'de', false)).toEqual(['de']);
  });

  it('is nothing when the read names no locale', () => {
    expect(localeOrder(ctx(trilingual), undefined)).toBeUndefined();
    expect(localeOrder(ctx(undefined), 'fr')).toEqual(['fr']);
  });
});

describe('mergeLocaleRows', () => {
  const rows = [
    { id: 'r-en', locale: 'en', ownerId: 'o', title: 'Home', body: 'Welcome' },
    { id: 'r-fr', locale: 'fr', ownerId: 'o', title: 'Accueil', body: null }
  ];

  it('takes each column from the first row in order that holds a value', () => {
    expect(mergeLocaleRows(rows, ['fr', 'en'])).toEqual({ title: 'Accueil', body: 'Welcome' });
    expect(mergeLocaleRows(rows, ['en', 'fr'])).toEqual({ title: 'Home', body: 'Welcome' });
  });

  it('ignores locales the order does not name, and rows the read did not return', () => {
    expect(mergeLocaleRows(rows, ['fr'])).toEqual({ title: 'Accueil', body: null });
    expect(mergeLocaleRows(rows, ['de'])).toEqual({});
    expect(mergeLocaleRows(undefined, ['fr'])).toEqual({});
  });

  it('reads an empty string as unwritten, the way a required column defaults to it', () => {
    const partial = [
      { id: 'r-en', locale: 'en', ownerId: 'o', title: 'Home', slug: '' },
      { id: 'r-fr', locale: 'fr', ownerId: 'o', title: 'Accueil', slug: 'accueil' }
    ];
    expect(mergeLocaleRows(partial, ['en', 'fr'])).toEqual({ title: 'Home', slug: 'accueil' });
  });

  it('never carries a row key over', () => {
    expect(mergeLocaleRows(rows, ['fr', 'en'])).not.toHaveProperty('id');
    expect(mergeLocaleRows(rows, ['fr', 'en'])).not.toHaveProperty('locale');
  });
});
