import { access } from '#lib/core/auth/access.js';
import { Collection } from '$rime/config';

export const Apps = Collection.create('apps', {
  auth: {
    type: 'apiKey',
    // `admin` for a key an admin makes: it passes as admin while its maker is one
    roles: ['apps', 'reports', 'admin']
  },
  fields: [],
  access: {
    create: (user) => access.isAdmin(user),
    // A key given the `reports` role reads the list.
    read: (user) => access.isAdmin(user) || access.hasRoles(user, 'reports'),
    update: (user) => access.isAdmin(user),
    delete: (user) => access.isAdmin(user)
  }
});
