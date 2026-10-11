import { describe, expect, it } from 'vitest';
import { toReferenceId, withReferenceIds } from './normalize-resolved-references.server.js';

describe('toReferenceId', () => {
  it('keeps an id', () => {
    expect(toReferenceId('abc')).toBe('abc');
  });

  it('reads the id off the referenced document a read handed back', () => {
    expect(toReferenceId({ id: 'abc', name: 'Ann' })).toBe('abc');
  });

  it('is null for nothing', () => {
    expect(toReferenceId('')).toBeNull();
    expect(toReferenceId(null)).toBeNull();
    expect(toReferenceId({ name: 'Ann' })).toBeNull();
    expect(toReferenceId({ id: '' })).toBeNull();
  });

  it('leaves a value that is not an id or a document as sent, for validation to refuse', () => {
    expect(toReferenceId(42)).toBe(42);
    expect(toReferenceId({ id: 42 })).toEqual({ id: 42 });
  });
});

describe('withReferenceIds', () => {
  it('writes the value at each path as its id, and leaves an absent one out', () => {
    const data = { author: { id: 'u1', name: 'Ann' }, meta: { owner: 'u2' } };
    expect(withReferenceIds(data, ['author', 'meta.owner', 'editor'])).toEqual({
      author: 'u1',
      meta: { owner: 'u2' }
    });
  });
});
