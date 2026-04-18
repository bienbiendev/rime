import { env } from '$env/dynamic/public';
import { adapterSqlite } from '$lib/adapter-sqlite/index.server';
import {
  block,
  blocks,
  date,
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
} from '$lib/fields/index.js';
import { bold } from '$lib/fields/rich-text/client.js';
import { access } from '$lib/util/access/index.js';
import { Area, Collection, Hooks, rime } from '$rime/config';
import { Images, ListTree, Newspaper, ReceiptText, Settings2, Text } from '@lucide/svelte';

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
  $url: (doc: any) => {
    return `${env.PUBLIC_RIME_URL}/${doc.locale}/about`;
  },
  live: true
});

/****************************************************
/* Pages
/****************************************************/

const setHome = Hooks.beforeUpsert<'pages'>(async (args) => {
  const { data, event } = args;

  if (data?.attributes?.isHome) {
    const query = `where[attributes.isHome][equals]=true`;

    const pagesIsHome = await event.locals.rime.collection('pages').find({ query });

    for (const page of pagesIsHome) {
      await event.locals.rime.collection('pages').updateById({
        id: page.id,
        data: { attributes: { isHome: false } }
      });
    }
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
      locale: event.locals.locale
    });
  };

  if (operation === 'create' || operation === 'update') {
    let slug = data.attributes?.slug;
    if (slug) {
      const baseSlug = slug;
      let suffix = 0;
      let pagesWithCurrentSlug = await queryPagesWithSlug({ slug: baseSlug });
      while (pagesWithCurrentSlug.some((page) => page.attributes.slug === slug)) {
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
  date('published')
);

const tabContent = tab('layout').fields(
  blocks('components', [blockParagraph, blockSlider, blockImage]).table().localized()
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
  $url: (doc) => {
    return `${env.PUBLIC_RIME_URL}/${doc.locale}/${doc.attributes.slug}`;
  },
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
  siteUrl: env.PUBLIC_RIME_URL,

  collections: [Pages, Medias],
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
