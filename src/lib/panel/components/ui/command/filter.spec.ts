import { describe, expect, it } from 'vitest';
import { byKeywords } from './filter.js';

describe('byKeywords', () => {
  const id = '3f2a9c1e-face-4b1d-9e0f-12ab34cd56ef';

  it('matches the keywords, not the value', () => {
    expect(byKeywords(id, 'face', ['About us'])).toBe(0);
    expect(byKeywords(id, 'about', ['About us'])).toBeGreaterThan(0);
  });

  it('matches nothing without keywords', () => {
    expect(byKeywords(id, 'face')).toBe(0);
  });
});
