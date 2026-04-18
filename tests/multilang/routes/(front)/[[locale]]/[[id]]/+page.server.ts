import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';

export const load = async (event: ServerLoadEvent) => {
  const { rime, user, locale } = event.locals;
  let { id } = event.params;

  //@ts-ignore
  if (!id && event.params.locale && !rime.config.isValidLocale(event.params.locale)) {
    //@ts-ignore
    id = event.params.locale;
  }

  const query = id
    ? `where[attributes.slug][equals]=${id}`
    : `where[attributes.isHome][equals]=true`;
  const docs = await rime.collection('pages').find({ query, locale, depth: 2 });
  if (!docs.length) {
    throw error(404, 'Not found');
  }

  if (user && docs[0]._live && event.url.searchParams.get('live') === '1') {
    return redirect(302, docs[0]._live);
  }

  return { doc: docs[0] };
};
