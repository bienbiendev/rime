import { SITE_URL } from '$app/env/public';
import { adapterSqlite } from '#lib/adapter-sqlite/index.server.js';
import {
  block,
  blocks,
  date,
  group,
  link,
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
const setHome = Hooks.beforeUpsert<'pages'>(async (args) => {
  const { data, event, context } = args;
  if (!data?.attributes?.isHome) return args;

  const pages = event.locals.rime.collection('pages');
  const homes = await pages.find({ query: `where[attributes.isHome][equals]=true` });
  for (const page of homes.filter((page) => page.id !== context.params.id)) {
    await pages.updateById({ id: page.id, data: { attributes: { isHome: false } } });
  }
  return args;
});

const formatslug = Hooks.beforeUpsert<'pages'>(async (args) => {
  const { operation, event } = args;
  let data = args.data;

  const queryPagesWithSlug = async ({ slug }: { slug: string }) => {
    const query = `where[attributes.slug][equals]=${slug}`;
    return event.locals.rime.collection('pages').find({
      query,
      locale: args.context.params.locale
    });
  };

  if (operation === 'create' || operation === 'update') {
    let slug = data.attributes?.slug;
    if (slug) {
      const baseSlug = slug;
      let suffix = 0;
      let pagesWithCurrentSlug = await queryPagesWithSlug({ slug: baseSlug });
      // A slug held by the page being updated is free.
      const ownId = args.context.params.id;
      const takenByOther = (pages: { id: string; attributes: { slug?: string } }[], slug: string) =>
        pages.some((page) => page.id !== ownId && page.attributes.slug === slug);

      while (takenByOther(pagesWithCurrentSlug, slug)) {
        suffix++;
        slug = `${baseSlug}-${suffix}`;
        pagesWithCurrentSlug = await queryPagesWithSlug({ slug });
      }
      data = {
        ...data,
        attributes: {
          ...(data.attributes || {}),
          slug
        }
      };
    }

    return {
      ...args,
      data
    };
  }
  return args;
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

  collections: [Pages, Medias, Notes],
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
