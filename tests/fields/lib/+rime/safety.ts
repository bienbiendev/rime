import { access } from '#lib/core/auth/access.js';
import { link, relation, richText, text } from '#lib/fields/index.js';
import { resource, upload } from '#lib/fields/rich-text/client.js';
import { Collection, Hooks } from '$rime/config';

/**
 * What a reader gets, written or read through rime's own steps — tests/fields/read-safety.test.ts.
 */

const anyone = () => true;
const staffOnly = (user?: any) => access.isStaff(user);
const adminOnly = (user?: any) => access.isAdmin(user);

// What the contact form's afterCreate hook received, whole
export const ContactLogs = Collection.create('contactLogs', {
  fields: [text('payload')]
});

const logContact = Hooks.afterCreate<'contacts'>(async (args) => {
  const { name, message, internalNote } = args.doc as any;
  await args.event.locals.rime
    .collection('contactLogs')
    .system()
    .create({
      data: { payload: JSON.stringify({ id: args.doc.id, name, message, internalNote }) }
    });
  return args;
});

// A contact form: anyone writes, staff reads, one field staff-only even then
export const Contacts = Collection.create('contacts', {
  access: { create: anyone },
  fields: [
    text('name').isTitle().access({ create: anyone }),
    text('message').access({ create: anyone }),
    text('internalNote').access({ create: anyone, read: staffOnly })
  ],
  $hooks: { afterCreate: [logContact] }
});

// Read by staff only: a media library and documents a public page points at
export const PrivateMedias = Collection.create('privateMedias', {
  upload: true,
  fields: [text('alt')]
});

export const PrivateDocs = Collection.create('privateDocs', {
  $url: ({ slug }) => `/private/${slug}`,
  fields: [text('title').isTitle(), text('secret').access({ read: adminOnly })]
});

// Read and written by anyone, with a staff-only field, and a thumbnail, relations, a link and
// rich-text images and resources to what only staff reads. Its rich text names other notices too.
export const Notices = Collection.create('notices', {
  access: { read: anyone, create: anyone, update: anyone },
  fields: [
    text('title').isTitle().access({ create: anyone, update: anyone }),
    text('draftNote').access({ create: anyone, update: anyone, read: staffOnly }),
    relation('cover').to('privateMedias').isThumbnail(),
    relation('related').to('privateDocs').many(),
    link('more').types('privateDocs'),
    richText('body').features(
      upload({ source: 'privateMedias' }),
      resource({ source: 'notices' }),
      resource({ source: 'privateDocs' })
    )
  ]
});

// Editors update, only admins create, with drafts. One field only admins read.
export const Reports = Collection.create('reports', {
  versions: { draft: true },
  access: { read: staffOnly, create: adminOnly, update: staffOnly },
  fields: [
    text('title').isTitle(),
    text('adminNote').access({ read: adminOnly, update: adminOnly })
  ]
});
