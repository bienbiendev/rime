import { email } from '$lib/fields/email/index.js';
import { select } from '$lib/fields/select/index.js';
import { text } from '$lib/fields/text/index.js';
import { access } from '$lib/core/features/auth/access.js';
import { validate } from '$lib/util/index.js';

const emailField = email('email')
  .access({
    create: () => true,
    read: (user) => !!user,
    update: () => false
  })
  .required()
  .unique();

const name = text('name')
  .access({
    create: () => true,
    read: (user) => !!user,
    update: () => false
  })
  .required();

const roles = select('roles')
  .options({ value: 'admin', label: 'Admin' }, { value: 'staff', label: 'Staff' })
  .many()
  .defaultValue(['staff'])
  .required()
  .access({
    create: () => true,
    read: (user) => !!user && access.isAdmin(user),
    update: (user) => !!user && access.isAdmin(user)
  });

const password = text('password')
  .required()
  .access({
    create: () => true,
    read: () => false,
    update: () => false
  })
  .validate((value) => validate.password(value));

/**
 * No `confirmPassword` here on purpose. It is a form control, not a document field: the
 * panel owns the match check (AuthFooter.svelte builds its own `text('confirmPassword')`),
 * because comparing two values the same client just sent proves nothing server-side.
 * Modelling it as a field is what used to force `restCreate` to fake the value.
 */
export const usersFields = {
  email: emailField,
  name,
  roles,
  password
};

export { emailField as email, name, password, roles };
