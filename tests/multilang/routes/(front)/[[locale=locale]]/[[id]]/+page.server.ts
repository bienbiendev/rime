import { SITE_URL } from '$app/env/public';
import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Serves the page whose url, in the request's locale, is this address, or the page marked home
 * when there is none, with the `infos` area its footer shows. The url is the one rime builds
 * from the page's address (`$url` in rime.config.server.ts). A first segment that is not a locale
 * is read as the slug:
 *
 *   /fr/about-us → the page at `${SITE_URL}/fr/about-us`
 *   /about-us    → the page at `${SITE_URL}/<default locale>/about-us`
 *
 * Staff asking `?live=1` go to the live editor.
 */
export const load = async (event: ServerLoadEvent) => {
  const { rime, user, locale } = event.locals;
  const { id } = event.params;

  const query = id
    ? `where[url][equals]=${encodeURIComponent(`${SITE_URL}/${locale}/${id}`)}`
    : `where[attributes.isHome][equals]=true`;
  const docs = await rime.collection('pages').find({ query, locale, depth: 2 });
  if (!docs.length) {
    throw error(404, 'Not found');
  }

  if (user && docs[0]._live && event.url.searchParams.get('live') === '1') {
    return redirect(302, docs[0]._live);
  }

  return { doc: docs[0], infos: await rime.area('infos').find({ locale }) };
};
