import { env } from '$env/dynamic/private';
import { PARAMS } from '$lib/core/constants.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';

/**
 * The live edit link, for staff, from the document's url: the panel opens the page there and
 * sends it the edited version's content. No query.
 */
export const setLiveUrl = Hooks.beforeRead<'generic'>(async function setLiveUrl(args) {
  const { config, event, context } = args;
  const doc = args.doc;
  if (!config.live || !event.locals.user?.isStaff || !doc.url) return args;

  let live = `${process.env.PUBLIC_RIME_URL}/${env.RIME_PANEL_ROUTE || 'panel'}/live-edit?src=${doc.url}&slug=${config.slug}&id=${doc.id}`;
  if (doc.contentId) live += `&${PARAMS.VERSION_ID}=${doc.contentId}`;
  if (context.params.locale) live += `&${PARAMS.LOCALE}=${context.params.locale}`;
  return { ...args, doc: { ...doc, _live: live } };
});
