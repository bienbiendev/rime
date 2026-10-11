import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { describe, expect, test } from 'vitest';
import en from './en/errors.js';
import fr from './fr/errors.js';

const codes: string[] = [...Object.values(RimeError), ...Object.values(RimeFormError)];

describe('error texts', () => {
  test.each(codes)('%s has a text in both languages', (code) => {
    expect(en[code as keyof typeof en]).toBeTypeOf('string');
    expect(fr[code as keyof typeof fr]).toBeTypeOf('string');
  });

  test('names no code that does not exist', () => {
    expect(Object.keys(en).filter((key) => !codes.includes(key))).toEqual([]);
    expect(Object.keys(fr).filter((key) => !codes.includes(key))).toEqual([]);
  });
});
