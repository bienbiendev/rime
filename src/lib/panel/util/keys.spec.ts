import { describe, expect, it } from 'vitest';
import { formatKeys, matches, parseKeys } from './keys.js';

const event = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers
  }) as KeyboardEvent;

describe('parseKeys', () => {
  it('reads the modifiers and the key', () => {
    expect(parseKeys('mod+s')).toEqual({ mod: true, shift: false, alt: false, key: 's' });
    expect(parseKeys('alt+arrowup')).toEqual({
      mod: false,
      shift: false,
      alt: true,
      key: 'arrowup'
    });
    expect(parseKeys('mod+shift+p')).toEqual({ mod: true, shift: true, alt: false, key: 'p' });
    expect(parseKeys('/')).toEqual({ mod: false, shift: false, alt: false, key: '/' });
    expect(parseKeys('Backspace')).toEqual({
      mod: false,
      shift: false,
      alt: false,
      key: 'backspace'
    });
  });
});

describe('matches', () => {
  it('takes ⌘ or Ctrl for mod', () => {
    expect(matches(event('s', { metaKey: true }), parseKeys('mod+s'))).toBe(true);
    expect(matches(event('s', { ctrlKey: true }), parseKeys('mod+s'))).toBe(true);
    expect(matches(event('S', { metaKey: true }), parseKeys('mod+s'))).toBe(true);
    expect(matches(event('s'), parseKeys('mod+s'))).toBe(false);
  });

  it('wants every modifier named and no other', () => {
    expect(matches(event('ArrowDown', { shiftKey: true }), parseKeys('shift+arrowdown'))).toBe(
      true
    );
    expect(matches(event('ArrowDown', { shiftKey: true }), parseKeys('arrowdown'))).toBe(false);
    expect(matches(event('ArrowDown', { altKey: true }), parseKeys('arrowdown'))).toBe(false);
    expect(matches(event('p', { metaKey: true }), parseKeys('mod+shift+p'))).toBe(false);
  });

  it('matches a single key', () => {
    expect(matches(event('/'), parseKeys('/'))).toBe(true);
    expect(matches(event('Escape'), parseKeys('escape'))).toBe(true);
  });
});

describe('formatKeys', () => {
  it('writes the Mac glyphs, and words elsewhere', () => {
    expect(formatKeys('mod+s', true)).toBe('⌘S');
    expect(formatKeys('mod+s', false)).toBe('Ctrl+S');
    expect(formatKeys('alt+arrowup', true)).toBe('⌥↑');
    expect(formatKeys('mod+shift+p', false)).toBe('Ctrl+Shift+P');
    expect(formatKeys('backspace', true)).toBe('⌫');
    expect(formatKeys('/', true)).toBe('/');
  });
});
