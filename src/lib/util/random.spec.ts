import { expect, test } from 'vitest';
import { randomPassword } from './random.js';

test('a password holds one character of each kind, so it has 4 at least', () => {
  expect(() => randomPassword(3)).toThrow(RangeError);
  expect(randomPassword(4)).toHaveLength(4);
});
