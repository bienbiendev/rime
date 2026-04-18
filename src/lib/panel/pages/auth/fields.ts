import type { EmailField, SimplerField, TextField } from '$lib/fields/types.js';
import { email as validateEmail } from '$lib/util/validate.js';

export const passwordField: SimplerField<TextField> = {
  name: 'password',
  type: 'text',
  layout: 'compact',
  required: true,
  isEmpty: (value) => !value
};

export const emailField: SimplerField<EmailField> = {
  name: 'email',
  type: 'email',
  layout: 'compact',
  required: true,
  validate: validateEmail,
  isEmpty: (value) => !value
};

export const nameField: SimplerField<TextField> = {
  name: 'name',
  type: 'text',
  layout: 'compact',
  required: true,
  isEmpty: (value) => !value
};
