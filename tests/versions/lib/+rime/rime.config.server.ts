import { SITE_URL } from '$app/env/public';
import { adapterSqlite } from '#lib/adapter-sqlite/index.server.js';
import { access } from '#lib/core/auth/access.js';
import {
  block,
  blocks,
  date,
  group,
  link,
  relation,
  richText,
  slug,
  tab,
  tabs,
  text,
  toggle
} from '#lib/fields/index.js';
import {
  bold,
  heading,
  italic,
  link as linkFeature,
  upload
} from '#lib/fields/rich-text/client.js';
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
  fields: [text('title'), text('email')],
  access: {
    read: (user) => access.hasRoles(user, 'admin')
  },
  versions: true
});

const tabWriter = tab('writer').fields(
  richText('text').features(
    bold(),
    italic(),
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
  relation('image').to('medias'),
  richText('intro').features(bold(), linkFeature()),
  date('published')
);

const News = Collection.create('news', {
  fields: [tabs(tabNewsAttributes, tabWriter)],
  live: true,
  $url: ({ slug }) => `${SITE_URL}/actualites/${slug}`,
  access: {
    read: () => true,
    create: (user) => access.isAdmin(user),
    update: (user) => access.isAdmin(user)
  },
  versions: { draft: true, autoSave: true }
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
  // A non-leaf field beside the sizes: the generated type must keep it.
  fields: [text('alt').required(), blocks('sections', [block('caption').fields(text('text'))])],
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
  // Three drafts kept: api.test.ts's pruning test passes the limit in a few writes
  versions: { draft: true, maxVersions: 3 }
});

const Pages = Collection.create('pages', {
  panel: {
    group: 'content'
  },
  fields: [group('attributes').fields(text('title').isTitle(), slug('slug'), toggle('isHome'))],
  $url: ({ path }) => `${SITE_URL}/${path.join('/')}`,
  nested: true,
  access: {
    read: () => true
  },
  versions: { draft: true }
});

// camelCase slugs: the panel and the API reach them by their kebab, `blog-posts` and `blog-pages`
const BlogPosts = Collection.create('blogPosts', {
  panel: { group: 'content' },
  // `code` is unique: drafts.test.ts checks it across documents and versions
  fields: [text('title').isTitle(), link('next').types('pages'), text('code').unique()],
  access: { read: () => true },
  versions: { draft: true }
});

const BlogPages = Collection.create('blogPages', {
  panel: { group: 'content' },
  fields: [text('title').isTitle()],
  nested: true,
  access: { read: () => true }
});

export default rime({
  $adapter: adapterSqlite('versions.sqlite'),
  collections: [News, Medias, Pdf, Pages, BlogPosts, BlogPages],
  areas: [Settings, Infos],
  $sse: {
    access: (key, user) => key.startsWith('public:') || key === `user:${user?.id}`
  }
});
