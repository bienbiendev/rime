import { SITE_URL } from '$app/env/public';
import { access } from '#lib/core/auth/access.js';
import { block, blocks, relation, select, text } from '#lib/fields/index.js';
import { Collection } from '$rime/config';
import Image from './renders/Image.svelte';

/**
 * Read by any staff member, updated by an admin only: an editor opens it read-only. Live, so
 * read-only.test.ts can check that the live button is disabled; no front route serves its url.
 * Its image block is drawn on the stage of focus mode, where a click never opens the library.
 */
export const Bulletins = Collection.create('bulletins', {
  fields: [
    text('title').isTitle(),
    select('topics').options('news', 'events', 'jobs').many(),
    blocks('sections', [
      block('image').fields(relation('image').to('medias')).render(Image, { controls: false })
    ])
  ],
  live: true,
  $url: ({ doc }) => `${SITE_URL}/bulletins/${doc.id}`,
  access: {
    read: (user) => access.isStaff(user),
    create: (user) => access.isAdmin(user),
    update: (user) => access.isAdmin(user)
  }
});
