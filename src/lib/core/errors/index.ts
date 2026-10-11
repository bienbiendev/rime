import { t__ } from '#lib/core/i18n/index.js';
import type { FormErrors } from '#lib/panel/types.js';

/**
 * The HTTP status of each code that is the client's doing. Any other code is the server's: 500,
 * logged with its stack.
 */
const CLIENT_STATUS: Record<string, number> = {
  bad_request: 400,
  form_error: 400,
  invalid_data: 400,
  invalid_credentials: 401,
  unauthorized: 403,
  not_found: 404
};

class RimeError extends Error {
  static BAD_REQUEST = 'bad_request';
  static CONFIG_ERROR = 'config_error';
  static FORM_ERROR = 'form_error';
  static INIT = 'init_error';
  static INVALID_CREDENTIALS = 'invalid_credentials';
  static INVALID_DATA = 'invalid_data';
  static MAIL_ERROR = 'mail_error';
  static NOT_FOUND = 'not_found';
  static OPERATION_ERROR = 'operation_error';
  static UNAUTHORIZED = 'unauthorized';
  static UPLOAD = 'upload_error';

  code: string;
  status: number;

  constructor(code: string, message?: string, ...args: any) {
    super(message ? `${code} — ${message}` : code, ...args);
    this.code = code;
    this.status = CLIENT_STATUS[code] ?? 500;
  }
}

class RimeFormError extends RimeError {
  static INVALID_DATE = 'invalid_date';
  static INVALID_EMAIL = 'invalid_email';
  static INVALID_FIELD = 'invalid_field';
  static INVALID_PHONE = 'invalid_phone';
  static INVALID_SLUG = 'invalid_slug';
  static INVALID_URL = 'invalid_url';
  static NOT_A_STRING = 'not_a_string';
  static PASSWORD_LOWERCASE_MISSING = 'password_lowercase_missing';
  static PASSWORD_MIN_8 = 'password_min_8';
  static PASSWORD_MISMATCH = 'password_mismatch';
  static PASSWORD_NUMBER_MISSING = 'password_number_missing';
  static PASSWORD_SPECIAL_CHAR_MISSING = 'password_special_char_missing';
  static PASSWORD_UPPERCASE_MISSING = 'password_uppercase_missing';
  static RELATION_NOT_FOUND = 'relation_not_found';
  static REQUIRED_FIELD = 'required_field';
  static UNIQUE_FIELD = 'unique_field';
  static UNKNOWN_BLOCK = 'unknown_block';
  static VALIDATION_ERROR = 'validation_error';

  errors: FormErrors;

  constructor(errors: FormErrors) {
    // { title: 'required_field', link: 'url::invalid_url' } -> "title: Required, link: Invalid URL"
    const lines = Object.entries(errors).map(([field, code]) => `${field}: ${errorText(code)}`);
    super(RimeError.FORM_ERROR, [...new Set(lines)].join(', '));

    this.errors = errors;
  }
}

export { RimeError, RimeFormError };

const CODES = new Set<string>([...Object.values(RimeError), ...Object.values(RimeFormError)]);

/**
 * The text of a field or form error. The part after the last `::` is read; a rime error code is
 * translated, any other string is a validator's own message and is shown as is.
 *
 * ```ts
 * errorText('required::required_field'); // 'Required'
 * errorText('url::invalid_url'); // 'Invalid URL'
 * errorText('Starts with a capital'); // 'Starts with a capital'
 * ```
 */
export function errorText(error: string): string {
  const code = error.split('::').at(-1) ?? '';
  return CODES.has(code) ? t__(`errors.${code}`) : code;
}
