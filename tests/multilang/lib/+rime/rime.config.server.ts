import { SITE_URL } from '$app/env/public';
import { adapterSqlite } from '#lib/adapter-sqlite/index.server.js';
import {
  block,
  blocks,
  date,
  group,
  link,
  number,
  radio,
  relation,
  richText,
  slug,
  tab,
  tabs,
  text,
  toggle,
  tree
} from '#lib/fields/index.js';
import { bold } from '#lib/fields/rich-text/client.js';
import { access } from '#lib/core/auth/access.js';
import { Area, Collection, Hooks, rime } from '$rime/config';
import Images from '@lucide/svelte/icons/images';
import ListTree from '@lucide/svelte/icons/list-tree';
import Newspaper from '@lucide/svelte/icons/newspaper';
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import Settings2 from '@lucide/svelte/icons/settings-2';
import Text from '@lucide/svelte/icons/text';

/****************************************************
/* Settings
/****************************************************/

const Settings = Area.create('settings', {
  icon: Settings2,
  panel: {
    group: 'informations'
  },
  fields: [
    toggle('minimalFooter').label('Minimal footer'),
    toggle('maintenance').label('Sticky header'),
    text('legalMention').label('Legals mentions').localized(),
    relation('logo').to('medias')
  ],

  access: {
    read: (user) => access.hasRoles(user, 'admin')
  }
});

/****************************************************
/*  Menu
/****************************************************/

const linkField = link('link').types('pages', 'infos', 'url').required();

const nav = tree('nav').fields(linkField);
const mainNav = tree('mainNav').fields(linkField).localized();

const Menu = Area.create('menu', {
  panel: {
    group: 'Content'
  },
  icon: ListTree,
  access: {
    read: () => true
  },
  fields: [nav, mainNav]
});

/****************************************************
/* Informations
/****************************************************/

const Informations = Area.create('infos', {
  icon: ReceiptText,
  panel: {
    group: 'informations'
  },
  fields: [
    richText('about').localized(),
    text('email').required(),
    text('instagram'),
    link('legals').localized()
  ],
  access: {
    read: () => true
  },
  $url: ({ locale }) => `${SITE_URL}/${locale}/about`,
  live: true
});

/****************************************************
/* Pages
/****************************************************/

/** When a save marks a page as home, the other pages marked home lose the mark. */
const setHome = Hooks.beforeUpsert<'pages'>(async function setHome(args) {
  const { data, event, context } = args;
  if (!data?.attributes?.isHome) return args;

  const pages = event.locals.rime.collection('pages');
  const homes = await pages.find({ query: `where[attributes.isHome][equals]=true` });
  for (const page of homes.filter((page) => page.id !== context.params.id)) {
    await pages.updateById({ id: page.id, data: { attributes: { isHome: false } } });
  }
  return args;
});

/**
 * Keeps slugs unique per locale: a slug another page holds in the locale of the write gets the
 * first free suffix.
 *
 * @example
 * // `concert` is taken in fr, `concert-1` too
 * // a write of { attributes: { slug: 'concert' } } in fr saves `concert-2`
 */
const formatslug = Hooks.beforeUpsert<'pages'>(async function formatslug(args) {
  const { event, data, context } = args;
  const baseSlug = data.attributes?.slug;
  if (!baseSlug) return args;

  // A slug held by the page being updated is free.
  const takenByOther = async (slug: string) => {
    const pages = await event.locals.rime.collection('pages').find({
      query: `where[attributes.slug][equals]=${slug}`,
      locale: context.params.locale
    });
    return pages.some((page) => page.id !== context.params.id && page.attributes.slug === slug);
  };

  let slug = baseSlug;
  let suffix = 0;
  while (await takenByOther(slug)) {
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  return { ...args, data: { ...data, attributes: { ...data.attributes, slug } } };
});

const blockParagraph = block('paragraph')
  .icon(Text)
  .description('Simple paragraph')
  .fields(richText('text').localized());

const blockSlider = block('slider').icon(Images).description('Simple slider').fields(text('image'));
const blockImage = block('image').fields(relation('image').to('medias'), text('legend'));

const tabHero = tab('hero').fields(
  radio('heroType').options('banner', 'text').defaultValue('banner'),
  relation('image')
    .to('medias')
    .condition((doc) => {
      return doc.heroType === 'banner';
    }),
  richText('intro').features(bold())
);

const tabAttributes = tab('attributes').fields(
  text('title').isTitle().localized().required(),
  toggle('isHome').table({ position: 2, sort: true }).live(false),
  slug('slug')
    .slugify('attributes.title')
    .live(false)
    .table({ position: 3, sort: true })
    .localized()
    .required(),

  relation('related').to('pages').many(),
  relation('author').to('staff'),
  relation('contributors').to('staff').many(),
  relation('ambassadors').to('staff').many().localized(),
  relation('notes').to('notes').many(),
  date('published'),

  // Not localized, with a hook that is not idempotent: a create runs it once, and a read in
  // any locale sees that one application.
  text('createMarker').$beforeSave((value) => (value ? `${value}-created` : value))
);

// Shared by every locale, each block's text localized: one set of rows, translated
const blockNote = block('note').fields(text('label').localized());
const blockQuote = block('quote').fields(text('text').localized(), text('author'));

const tabContent = tab('layout').fields(
  blocks('components', [blockParagraph, blockSlider, blockImage]).table().localized(),
  blocks('sections', [blockNote, blockQuote])
);

const tabSeo = tab('seo').fields(
  text('metaTitle').localized(),
  text('metaDescription').localized()
);

const tabFooter = tab('footer').fields(text('slider').localized());

const Pages = Collection.create('pages', {
  icon: Newspaper,
  panel: {
    group: 'Content'
  },
  fields: [tabs(tabHero, tabContent, tabAttributes, tabSeo, tabFooter)],
  $url: ({ locale, slug }) => `${SITE_URL}/${locale}/${slug}`,
  live: true,
  access: {
    read: () => true,
    create: (user) => access.isAdmin(user),
    update: (user) => access.hasRoles(user, 'admin', 'editor')
  },
  $hooks: {
    beforeCreate: [formatslug, setHome],
    beforeUpdate: [formatslug, setHome]
  }
});

/****************************************************
/* Notes
/****************************************************/

// Readable by admins only: a relation to one is left out for anybody else.
const Notes = Collection.create('notes', {
  icon: Text,
  panel: {
    group: 'Content'
  },
  fields: [
    text('body').isTitle(),
    // A field inside tabs takes the locale of the group around it
    group('meta')
      .fields(tabs(tab('seo').fields(text('metaTitle'))))
      .localized()
  ],
  access: {
    read: (user) => access.isAdmin(user),
    create: (user) => access.isAdmin(user),
    update: (user) => access.isAdmin(user),
    delete: (user) => access.isAdmin(user)
  }
});

/****************************************************
/* Articles
/****************************************************/

// Required and localized, of each storage type: a locale written in part falls back for the rest
const Articles = Collection.create('articles', {
  icon: Text,
  panel: {
    group: 'Content'
  },
  fields: [
    text('title').isTitle().localized().required(),
    richText('body').localized().required(),
    number('readingTime').localized().required()
  ],
  access: {
    read: () => true,
    create: (user) => access.isAdmin(user),
    update: (user) => access.isAdmin(user),
    delete: (user) => access.isAdmin(user)
  }
});

/****************************************************
/* Medias
/****************************************************/

const Medias = Collection.create('medias', {
  icon: Images,
  panel: {
    group: 'Medias'
  },
  upload: {
    imageSizes: [
      { name: 'thumbnail', width: 400, out: ['webp'] },
      { name: 'small', width: 720, out: ['webp'] },
      { name: 'medium', width: 720, height: 1024, out: ['webp'] },
      { name: 'large', width: 1080, out: ['webp'] }
    ]
  },
  fields: [text('alt').required()],
  access: {
    read: () => true
  }
});

export default rime({
  //
  $adapter: adapterSqlite('multilang.sqlite'),
  siteUrl: SITE_URL,

  collections: [Pages, Medias, Notes, Articles],
  areas: [Settings, Informations, Menu],

  localization: {
    locales: [
      { code: 'fr', label: 'Français' },
      { code: 'en', label: 'English' }
    ],
    default: 'fr'
  },

  staff: {
    roles: [{ value: 'admin', label: 'Administrator' }, { value: 'editor' }],
    fields: [text('website')],
    panel: {
      group: 'administration'
    },
    access: {
      read: () => true
    }
  },

  panel: {
    language: 'fr',
    $access: (user) => access.hasRoles(user, 'admin', 'editor')
  }
});
