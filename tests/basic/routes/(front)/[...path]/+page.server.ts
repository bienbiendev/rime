import { SITE_URL } from '$app/env/public';
import { checkLiveRedirect } from '#lib/panel/util/live.server.js';
import { error, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Serves the page whose url is this address, as `buildPagesUrl` builds it: `/` is the page
 * marked home, `/about-us` a page under it. Staff asking `?live=1` go to the live editor.
 */
export const load = async (event: ServerLoadEvent) => {
  const { rime } = event.locals;
  const url = `${SITE_URL}/${event.params.path ?? ''}`;

  const query = `where[url][equals]=${encodeURIComponent(url)}`;
  const docs = await rime.collection('pages').find({ query, depth: 2 });
  if (!docs.length) {
    throw error(404, 'Not found');
  }

  // The page shows the maintenance flag to every visitor, while the area itself stays admin-only.
  const settings = await rime
    .area('settings')
    .system()
    .find({ select: ['maintenance'] });

  checkLiveRedirect(docs[0], event);

  return { doc: docs[0], settings };
};
