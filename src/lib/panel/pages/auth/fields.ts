import { RimeFormError } from '#lib/core/errors/index.js';
import { email as validateEmail, password as validatePassword } from '#lib/core/fields/validate.js';
import { email } from '#lib/fields/email/index.js';
import { text } from '#lib/fields/text/index.js';

// A new builder on each call: one page's `.placeholder()` never reaches another page

/** The password typed to sign in. */
export const passwordField = () => text('password').required();

/** A password being set: as strong as `validate.password` asks. */
export const newPasswordField = () => text('password').required().validate(validatePassword);

/** The confirmation typed under a new password: equal to it. */
export const confirmPasswordField = () =>
  text('confirmPassword')
    .required()
    .validate((value, { data }) => value === data.password || RimeFormError.PASSWORD_MISMATCH);

export const emailField = () => email('email').layout('compact').required().validate(validateEmail);
