import { redirect, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Serves the `infos` area in the request's locale, its relations resolved one level. Staff asking
 * `?live=1` go to the live editor.
 */
export const load = async (event: ServerLoadEvent) => {
  const { rime, user, locale } = event.locals;

  const doc = await rime.area('infos').find({ locale, depth: 1 });

  if (user && doc._live && event.url.searchParams.get('live') === '1') {
    return redirect(302, doc._live);
  }

  return { doc: doc };
};
