import { RimeFormError } from '#lib/core/errors/index.js';
import { describe, expect, it, test } from 'vitest';
import validate, { password, tel } from './validate.js';

describe('validate.link', () => {
  test('refuses a value that is not a link object', () => {
    expect(validate.link(null)).toBe(RimeFormError.INVALID_FIELD);
    expect(validate.link('https://rime.dev')).toBe(RimeFormError.INVALID_FIELD);
  });

  test('refuses a type the field does not offer, and keeps the kind rules without a field', () => {
    const script = { type: 'other', value: 'javascript:alert(1)' };
    const context = { config: { types: ['url', 'pages'] } };
    expect(validate.link(script, context)).toBe(RimeFormError.INVALID_FIELD);
    expect(validate.link({ type: 'pages', value: 'p1' }, context)).toBe(true);
    expect(validate.link(script)).toBe(true);
  });
});

describe('password', () => {
  it('counts any character that is not a letter or a digit as special', () => {
    for (const special of ['/', ',', '[', '~', ' ']) {
      expect(password(`Secure1Password${special}`)).toBe(true);
    }
    expect(password('Secure1Password')).toBe(RimeFormError.PASSWORD_SPECIAL_CHAR_MISSING);
  });
});

describe('tel', () => {
  it('takes digits with the punctuation numbers are written with, and refuses blanks', () => {
    expect(tel('+33 (0)1 23-45')).toBe(true);
    expect(tel('06.12.34.56.78')).toBe(true);
    expect(tel('   ')).toBe(RimeFormError.INVALID_PHONE);
    expect(tel('+++')).toBe(RimeFormError.INVALID_PHONE);
    expect(tel('1+2')).toBe(RimeFormError.INVALID_PHONE);
  });
});
