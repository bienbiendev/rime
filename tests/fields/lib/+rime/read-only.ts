import { SITE_URL } from '$app/env/public';
import { access } from '#lib/core/auth/access.js';
import { select, text } from '#lib/fields/index.js';
import { Collection } from '$rime/config';

/** Read by any staff member, updated by an admin only: an editor opens it read-only. */
export const Bulletins = Collection.create('bulletins', {
  fields: [text('title').isTitle(), select('topics').options('news', 'events', 'jobs').many()],
  live: true,
  $url: ({ doc }) => `${SITE_URL}/bulletins/${doc.id}`,
  access: {
    read: (user) => access.isStaff(user),
    create: (user) => access.isAdmin(user),
    update: (user) => access.isAdmin(user)
  }
});
