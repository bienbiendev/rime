/**
 * Generates a random alphanumeric string of specified length.
 * Useful for creating unique identifiers, temporary tokens, or random keys.
 *
 * @example
 * // Generate a random ID with 10 characters
 * const id = randomId(10);
 * // Result example: "a7bF9cD3eZ"
 */
export const randomId = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let result = '';
  const randomValues = new Uint32Array(length);

  // Use crypto.getRandomValues for better randomness when available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += characters.charAt(randomValues[i] % charactersLength);
    }
  } else {
    // Fallback to Math.random
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
  }
  return result;
};

/**
 * Generate a secure random password with uppercase, lowercase, numbers and symbols
 *
 * @example
 * // Generate a password with default length (12)
 * const password = generateSecurePassword();
 *
 * // Generate a password with custom length
 * const longPassword = generateSecurePassword(16);
 */
export const randomPassword = (length = 12): string => {
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const symbolChars = '!@#$%^&*()_-+=[]{}|:;<>,.?/~';

  // All possible characters
  const allChars = uppercaseChars + lowercaseChars + numberChars + symbolChars;

  let password = '';

  // Use crypto.getRandomValues for better randomness when available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Ensure we have at least one character from each character set
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    // First add one character from each required set
    password += uppercaseChars.charAt(randomValues[0] % uppercaseChars.length);
    password += lowercaseChars.charAt(randomValues[1] % lowercaseChars.length);
    password += numberChars.charAt(randomValues[2] % numberChars.length);
    password += symbolChars.charAt(randomValues[3] % symbolChars.length);

    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars.charAt(randomValues[i] % allChars.length);
    }

    // Shuffle the password
    const shuffleValues = new Uint32Array(length);
    crypto.getRandomValues(shuffleValues);

    password = shuffleString(password, shuffleValues);
  } else {
    // Fallback to Math.random
    password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
    password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
    password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
    password += symbolChars.charAt(Math.floor(Math.random() * symbolChars.length));

    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle the password
    password = shuffleString(password);
  }

  return password;
};

/**
 * Shuffle a string using Fisher-Yates algorithm
 */
const shuffleString = (str: string, randomValues?: Uint32Array): string => {
  const array = str.split('');

  for (let i = array.length - 1; i > 0; i--) {
    let j;
    if (randomValues && i < randomValues.length) {
      j = randomValues[i] % (i + 1);
    } else {
      j = Math.floor(Math.random() * (i + 1));
    }
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join('');
};
