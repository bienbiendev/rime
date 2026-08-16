import { email } from '$lib/fields/email/index.js';
import { text } from '$lib/fields/text/index.js';
import { email as validateEmail } from '$lib/util/validate.js';

export const passwordField = text('password').required();
export const confirmPasswordField = text('confirmPassword').required();
export const emailField = email('email').layout('compact').required().validate(validateEmail);
export const nameField = text('name').layout('compact').required();
