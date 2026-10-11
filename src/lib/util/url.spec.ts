import { describe, expect, it } from 'vitest';
import { isSafeUrl } from './url.js';

describe('isSafeUrl', () => {
  it.each(['/about', 'https://rime.dev', 'mailto:a@b.c', '#top', '?page=2'])('keeps %j', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:x',
    'java\tscript:alert(1)',
    'vbscript:x',
    'data:text/html,x'
  ])('refuses %j', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});
