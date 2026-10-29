import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Serves the page whose slug, in the request's locale, is `id`, or the page marked home when
 * there is none. A first segment that is not a locale is read as the slug:
 *
 *   /fr/about-us → slug `about-us`, locale fr
 *   /about-us    → slug `about-us`, the default locale
 *
 * Staff asking `?live=1` go to the live editor.
 */
export const load = async (event: ServerLoadEvent) => {
  const { rime, user, locale } = event.locals;
  const { id } = event.params;

  const query = id
    ? `where[attributes.slug][equals]=${encodeURIComponent(id)}`
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
