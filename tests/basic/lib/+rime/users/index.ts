import { text } from '#lib/fields/index.js';
import { access } from '#lib/core/auth/access.js';
import { Collection } from '$rime/config';
import { hooks } from '$rime/modules:+rime/users';

export const Users = Collection.create('users', {
  auth: {
    type: 'password',
    roles: ['user', 'member']
  },
  fields: [text('website')],
  access: {
    create: () => true,
    read: () => true,
    update: (user, { id }) => access.isAdminOrMe(user, id),
    delete: (user, { id }) => access.isAdminOrMe(user, id)
  },
  $hooks: hooks
});
