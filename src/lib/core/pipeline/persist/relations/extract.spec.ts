import { relation } from '$lib/fields/index.js';
import { describe, expect, it } from 'vitest';
import { extractRelations } from './extract.server.js';

// Cast: `users` is only a registered slug in the fixture that declares it.
const author = (relation('author') as any).to('users');
const extract = (value: unknown) =>
  extractRelations({
    ownerId: 'p1',
    data: { author: value },
    configMap: { author },
    locale: undefined
  });

const row = (documentId: string, position: number, id?: string) => ({
  id,
  position,
  relationTo: 'users',
  documentId,
  ownerId: 'p1',
  path: 'author'
});

describe('extractRelations', () => {
  it('reads bare ids and refs, a ref keeping its row', () => {
    expect(extract('u1')).toEqual([row('u1', 0)]);
    expect(extract(['u1', 'u2'])).toEqual([row('u1', 0), row('u2', 1)]);
    expect(extract([{ id: 'r1', relationTo: 'users', documentId: 'u1' }])).toEqual([
      row('u1', 0, 'r1')
    ]);
  });

  it('reads a document sent back as its id, not as a row', () => {
    const doc = { id: 'u1', _type: 'users', name: 'Ann' };
    expect(extract([doc])).toEqual([row('u1', 0)]);
  });

  it('reads one ref outside an array as a list of one', () => {
    expect(extract({ relationTo: 'users', documentId: 'u1' })).toEqual([row('u1', 0)]);
  });

  it('skips what names nothing, the positions following what is left', () => {
    expect(extract([null, 'u1', '', undefined, 'u2'])).toEqual([row('u1', 0), row('u2', 1)]);
    expect(extract(null)).toEqual([]);
    expect(extract([])).toEqual([]);
  });
});
