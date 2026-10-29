const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PASSWORD_KINDS = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  '!@#$%^&*()_-+=[]{}|:;<>,.?/~'
];
const PASSWORD_CHARS = PASSWORD_KINDS.join('');

/** `count` random 32-bit integers from `crypto`. */
const randomValues = (count: number) => crypto.getRandomValues(new Uint32Array(count));

/** The character of `chars` a random integer picks. */
const pick = (chars: string, value: number) => chars.charAt(value % chars.length);

/**
 * A random alphanumeric string of `length` characters, from `crypto.getRandomValues`.
 * `randomId(32)` is the `BETTER_AUTH_SECRET` that `rime init` writes.
 *
 * @example
 * randomId(10); // "a7bF9cD3eZ"
 */
export const randomId = (length: number): string =>
  Array.from(randomValues(length), (value) => pick(ALPHANUMERIC, value)).join('');

/** The id of a row not saved yet: a save adds it and gives it a real one. `temp-3f9aK2bQ` */
export const tempId = () => `temp-${randomId(8)}`;

/** Whether a row id is a temp id: the row is not saved yet. */
export const isTempId = (id: string) => id.startsWith('temp-');

/** `array` shuffled in place (Fisher-Yates), from `crypto`. */
const shuffle = <T>(array: T[]) => {
  const values = randomValues(array.length);
  for (let i = array.length - 1; i > 0; i--) {
    const j = values[i] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * A random password of `length` characters, from `crypto`, holding at least one upper-case
 * letter, one lower-case letter, one digit and one symbol. A length under 4 throws a
 * `RangeError`.
 *
 * @example
 * randomPassword(); // 12 characters
 * randomPassword(16); // 16 characters
 */
export const randomPassword = (length = 12): string => {
  if (length < 4) {
    throw new RangeError(`A password holds one character of each kind: 4 at least, got ${length}`);
  }
  const values = randomValues(length);
  const oneOfEach = PASSWORD_KINDS.map((chars, index) => pick(chars, values[index]));
  const rest = Array.from(values.slice(4), (value) => pick(PASSWORD_CHARS, value));
  return shuffle([...oneOfEach, ...rest]).join('');
};
