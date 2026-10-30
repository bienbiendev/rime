import { describe, expect, it } from 'vitest';
import { queryOf } from './query.js';

describe('queryOf', () => {
  it('answers a function query for the values given', () => {
    const field = { query: (doc: any) => `where[country][equals]=${doc.country}` };
    expect(queryOf(field, { country: 'fr' })).toBe('where[country][equals]=fr');
    expect(queryOf(field, { country: 'it' })).toBe('where[country][equals]=it');
  });

  it('answers a string query as is, and an empty string without a query', () => {
    expect(queryOf({ query: 'where[mimeType][like]=image%' }, {})).toBe(
      'where[mimeType][like]=image%'
    );
    expect(queryOf({}, {})).toBe('');
  });
});
