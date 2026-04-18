import { email } from '$lib/fields/email/index.js';
import { select } from '$lib/fields/select/index.js';
import { text } from '$lib/fields/text/index.js';
import { access } from '$lib/util/access/index.js';
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

const confirmPassword = text('confirmPassword')
  .label('Confirm password')
  .required()
  .validate((value, metas) => {
    if (metas.data.password !== value) {
      return 'password_mismatch';
    }
    return true;
  });

export const usersFields = {
  email: emailField,
  name,
  roles,
  password,
  confirmPassword
};

export { confirmPassword, emailField as email, name, password, roles };
