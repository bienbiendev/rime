import {
  component,
  group,
  relation,
  richText,
  select,
  separator,
  slug,
  tab,
  tabs,
  text,
  textarea,
  toggle
} from '$lib/fields/index.js';
import { access } from '$lib/util/access/index.js';
import { buildPagesUrl, hooks } from '$rime/+rime/pages';
import { Collection } from '$rime/config';
import { Newspaper } from '@lucide/svelte';
import URL from '../components/URL.svelte';
import { tabLayout } from './tab-layout';

const tabSEO = tab('metas')
  .label('SEO')
  .fields(
    text('title').label('Meta title').layout('compact'),
    textarea('description').label('Meta description')
  )
  .live(false);

const tabAttributes = tab('attributes')
  .label('Attributes')
  .fields(
    text('title').isTitle().required().layout('compact'),
    component(URL),
    toggle('isHome').label('Homepage').live(false).table(2),
    slug('slug')
      .slugify('attributes.title')
      .condition((_, siblings) => siblings.isHome !== true)
      .live(false),
    separator(),
    group('summary').fields(relation('thumbnail').to('medias'), richText('intro')),
    separator(),
    select('template')
      .options('basic', 'large')
      .access({
        create: (user) => access.isAdmin(user),
        update: (user) => access.isAdmin(user),
        read: () => true
      })
  );

export const Pages = Collection.create('pages', {
  label: { singular: 'Page', plural: 'Pages' },
  panel: {
    group: 'content',
    description: 'Edit and create your website pages'
  },
  icon: Newspaper,
  fields: [tabs(tabAttributes, tabLayout, tabSEO)],
  live: true,
  nested: true,
  $url: buildPagesUrl,
  access: {
    read: () => true,
    create: (user) => access.isAdmin(user),
    update: (user) => access.hasRoles(user, 'admin', 'editor')
  },
  $hooks: hooks
});
