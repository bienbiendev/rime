import { date, richText, slug, tab, tabs, text } from '$lib/fields/index.js';
import {
  bold,
  heading,
  italic,
  link as linkFeature,
  resource,
  upload
} from '$lib/fields/rich-text/client.js';
import { buildNewsUrl } from '$rime/modules';
import { Collection } from '$rime/config';
import LoremFeature from '../lorem-fill.js';

import { access } from '$lib/core/features/auth/access.js';
import { NotebookText } from '@lucide/svelte';

const tabWriter = tab('writer').fields(
  richText('text').features(
    bold(),
    italic(),
    LoremFeature,
    resource({ source: 'pages' }),
    upload({ source: 'medias?where[mimeType][like]=image' }),
    heading(2, 3),
    linkFeature()
  )
);

const tabNewsAttributes = tab('attributes').fields(
  text('title').isTitle().localized().required(),
  slug('slug')
    .slugify('attributes.title')
    .live(false)
    .table({ position: 3, sort: true })
    .localized()
    .required(),
  richText('intro').features(bold(), linkFeature()),
  date('published')
);

export const News = Collection.create('news', {
  icon: NotebookText,
  panel: {
    description: 'Create article for your readers',
    group: 'content'
  },
  fields: [tabs(tabNewsAttributes, tabWriter)],
  live: true,
  $url: buildNewsUrl,
  access: {
    read: () => true,
    create: (user) => access.isAdmin(user),
    update: (user) => access.hasRoles(user, 'admin', 'editor')
  }
});
