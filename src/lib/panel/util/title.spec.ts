import { describe, expect, it } from 'vitest';
import { titleText } from './title.js';

describe('titleText', () => {
  it('reads a string as it is', () => {
    expect(titleText('About')).toBe('About');
  });

  it('reads rich text as its plain text', () => {
    const heading = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'About' }] }]
    };
    expect(titleText(heading)).toBe('About');
  });

  it('reads a date or no value as empty', () => {
    expect(titleText(new Date('2026-10-10'))).toBe('');
    expect(titleText(null)).toBe('');
  });
});
