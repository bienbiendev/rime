import { describe, expect, it } from 'vitest';
import { toReferenceId } from './normalize-resolved-references.server.js';

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
  });
});
