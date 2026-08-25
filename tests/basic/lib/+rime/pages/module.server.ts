import { Hooks } from '$rime/config';

export const buildPagesUrl = (doc: { attributes: { isHome?: boolean; slug: string } }) =>
  doc.attributes.isHome
    ? `${process.env.PUBLIC_RIME_URL}/`
    : `${process.env.PUBLIC_RIME_URL}/[...parent.attributes.slug]/${doc.attributes.slug}`;

const clearCacheHook = Hooks.afterUpsert<'pages'>(async (args) => {
  args.event.locals.rime.cache.clear();
  return args;
});

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

export const hooks = {
  afterUpdate: [clearCacheHook],
  afterCreate: [clearCacheHook],
  beforeCreate: [setHome],
  beforeUpdate: [setHome],
  beforeRead: [
    Hooks.beforeRead(async (args) => {
      args.event.locals.rime.logger.info('Reading a page document');
      return args;
    })
  ]
};
