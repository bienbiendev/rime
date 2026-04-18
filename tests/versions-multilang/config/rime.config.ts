import { adapterSqlite } from '$lib/adapter-sqlite/index.server';
import {
  date,
  group,
  relation,
  richText,
  slug,
  tab,
  tabs,
  text,
  toggle
} from '$lib/fields/index.js';
import {
  bold,
  heading,
  italic,
  link as linkFeature,
  upload
} from '$lib/fields/rich-text/client.js';
import { access } from '$lib/util/access/index.js';
import { Area, Collection, rime } from '$rime/config';

const Settings = Area.create('settings', {
  fields: [
    text('title'),
    toggle('maintenance').label('Maintenance').required(),
    relation('logo').to('medias')
  ],
  access: {
    read: (user) => access.hasRoles(user, 'admin')
  },
  versions: { draft: true }
});

const Infos = Area.create('infos', {
  fields: [text('title').localized(), text('email').localized()],
  access: {
    read: (user) => access.hasRoles(user, 'admin')
  },
  versions: true
});

const tabWriter = tab('writer').fields(
  richText('text').features(
    bold(),
    italic(),
    upload({ slug: 'medias', query: 'where[mimeType][like]=image' }),
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
  relation('image').to('medias'),
  richText('intro').features(bold(), linkFeature()),
  date('published')
);

const News = Collection.create('news', {
  fields: [tabs(tabNewsAttributes, tabWriter)],
  live: true,
  $url: (doc) => `${process.env.PUBLIC_RIME_URL}/actualites/${doc.attributes.slug}`,
  access: {
    read: () => true,
    create: (user) => access.isAdmin(user),
    update: (user) => access.hasRoles(user, 'admin', 'editor')
  },
  versions: { draft: true }
});

const Medias = Collection.create('medias', {
  panel: {
    group: 'content'
  },
  upload: {
    imageSizes: [
      { name: 'thumbnail', width: 400, out: ['webp'] },
      { name: 'small', width: 720, out: ['webp'] },
      { name: 'medium', width: 720, height: 1024, out: ['webp'] },
      { name: 'large', width: 1080, out: ['webp'] }
    ]
  },
  fields: [text('alt').localized().required()],
  access: {
    read: () => true
  },
  versions: true
});

const Pdf = Collection.create('pdf', {
  upload: true,
  panel: {
    group: 'content'
  },
  fields: [text('alt').required()],
  access: {
    read: () => true
  },
  versions: { draft: true }
});

const Pages = Collection.create('pages', {
  panel: {
    group: 'content'
  },
  fields: [
    //
    group('attributes').fields(
      //
      text('title').isTitle(),
      slug('slug'),
      toggle('isHome')
    )
  ],
  $url: () => '/',
  nested: true,
  access: {
    read: () => true
  },
  versions: { draft: true }
});

export default rime({
  $adapter: adapterSqlite('versions-multilang.sqlite'),
  collections: [News, Medias, Pdf, Pages],
  areas: [Settings, Infos],
  localization: {
    locales: [
      { code: 'fr', label: 'Français' },
      { code: 'en', label: 'English' },
      { code: 'de', label: 'German' }
    ],
    default: 'en'
  },
  staff: {
    roles: [{ value: 'editor' }]
  }
});
