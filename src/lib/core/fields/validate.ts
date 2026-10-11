import { RimeFormError } from '#lib/core/errors/index.js';

/**
 * Validates a password string against security requirements.
 * Checks for minimum length, lowercase, uppercase, numbers, and a special character: anything that
 * is not a letter or a digit.
 *
 * @example
 * // Returns true for a valid password
 * password("Secure1Password!");
 *
 * // Returns an error code for an invalid password
 * password("weak"); // Returns RimeFormError.PASSWORD_MIN_8
 */
export const password = (value: unknown) => {
  if (typeof value !== 'string') {
    return RimeFormError.NOT_A_STRING;
  }
  if (value.length < 8) {
    return RimeFormError.PASSWORD_MIN_8;
  } else if (!/[a-z]/.test(value)) {
    return RimeFormError.PASSWORD_LOWERCASE_MISSING;
  } else if (!/[A-Z]/.test(value)) {
    return RimeFormError.PASSWORD_UPPERCASE_MISSING;
  } else if (!/\d/.test(value)) {
    return RimeFormError.PASSWORD_NUMBER_MISSING;
  } else if (!/[^a-zA-Z0-9]/.test(value)) {
    return RimeFormError.PASSWORD_SPECIAL_CHAR_MISSING;
  }
  return true;
};

/**
 * Validates an email address string.
 * Ensures the email follows standard format with proper characters and domain structure.
 *
 * @example
 * // Returns true for a valid email
 * email("user@example.com");
 *
 * // Returns an error code for an invalid email
 * email("invalid-email"); // Returns RimeFormError.INVALID_EMAIL
 */
export const email = (value: unknown) => {
  if (typeof value !== 'string') {
    return RimeFormError.NOT_A_STRING;
  }
  // The part before the @ is words of letters, digits and !#$%&'*+/=?^_`{|}~-
  // joined by single dots: ann+news@x.com and o'brien@x.io pass, a..b@x.io and .a@x.io do not.
  if (!/^[\w!#$%&'*+/=?^`{|}~-]+(?:\.[\w!#$%&'*+/=?^`{|}~-]+)*@[^\s@]+\.[^\s@]+$/.test(value)) {
    return RimeFormError.INVALID_EMAIL;
  }
  return true;
};

/**
 * Validates a telephone number string: an optional leading `+`, digits, and spaces, dots, dashes
 * or parentheses between them.
 *
 * @example
 * // Returns true for a valid phone number
 * tel("+1 555 123 4567");
 *
 * // Returns an error code for an invalid phone number
 * tel("abc123"); // Returns RimeFormError.INVALID_PHONE
 */
export const tel = (value: unknown) => {
  if (typeof value !== 'string') {
    return RimeFormError.NOT_A_STRING;
  }
  if (!/^\+?[\d\s().-]+$/.test(value) || !/\d/.test(value)) {
    return RimeFormError.INVALID_PHONE;
  }
  return true;
};

/**
 * Validates a URL string.
 * Ensures the URL follows standard HTTP/HTTPS format with proper domain structure.
 *
 * @example
 * // Returns true for a valid URL
 * url("https://example.com/page");
 *
 * // Returns an error code for an invalid URL
 * url("not-a-url"); // Returns RimeFormError.INVALID_URL
 */
export const url = (value: unknown) => {
  if (typeof value !== 'string') {
    return RimeFormError.NOT_A_STRING;
  }

  try {
    const url = new URL(value);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return RimeFormError.INVALID_URL;
    }
    return true;
  } catch {
    return RimeFormError.INVALID_URL;
  }
};

/**
 * Validates a slug string.
 * Ensures the slug contains only lowercase letters, numbers, and hyphens.
 *
 * @example
 * // Returns true for a valid slug
 * slug("my-page-slug-123");
 *
 * // Returns an error code for an invalid slug
 * slug("Invalid Slug!"); // Returns RimeFormError.INVALID_SLUG
 */
export const slug = (value: unknown) => {
  if (typeof value !== 'string') {
    return RimeFormError.NOT_A_STRING;
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return RimeFormError.INVALID_SLUG;
  }
  return true;
};

/**
 * Validates a link object with different validation based on link type.
 * Supports tel, email, url, and anchor link types. A value that is not an object is refused, and
 * so is a type the field's `types` do not name, when the field is given.
 *
 * @example
 * // Returns true for a valid email link
 * link({ type: 'email', value: 'user@example.com' });
 *
 * // Returns an error string for an invalid URL link
 * link({ type: 'url', value: 'invalid-url' }); // Returns "url::invalid_url"
 *
 * link(null); // Returns RimeFormError.INVALID_FIELD
 * link({ type: 'other', value: 'x' }, { config: { types: ['url'] } }); // RimeFormError.INVALID_FIELD
 */
export const link = (link: unknown, context?: { config?: { types?: string[] } }) => {
  if (!link || typeof link !== 'object') return RimeFormError.INVALID_FIELD;
  const { type, value } = link as { type?: string; value?: string };
  const types = context?.config?.types;
  if (types && !types.includes(type ?? '')) return RimeFormError.INVALID_FIELD;
  if (value === '') return true;

  if (type === 'tel') {
    const valid = validate.tel(value);
    return typeof valid === 'string' ? `tel::${valid}` : true;
  }
  if (type === 'email') {
    const valid = validate.email(value);
    return typeof valid === 'string' ? `email::${valid}` : true;
  }
  if (type === 'url') {
    const valid = validate.url(value);
    return typeof valid === 'string' ? `url::${valid}` : true;
  }
  if (type === 'anchor') {
    const valid = validate.slug(value);
    return typeof valid === 'string' ? `anchor::${valid}` : true;
  }
  return true;
};

/**
 * Collection of validation utility functions for common data types.
 * Each function returns true if the value is valid, or an error code/message if invalid.
 */
const validate = {
  password,
  email,
  slug,
  url,
  tel,
  link
};

export default validate;
