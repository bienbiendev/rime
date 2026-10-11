import { RIME_PANEL_ROUTE } from '$app/env/private';
import { SITE_URL } from '$app/env/public';
import { PARAMS } from '#lib/core/constants.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';

/**
 * The live edit link, for staff, from the document's url: the panel opens the page there and
 * sends it the edited version's content.
 *
 * ```
 * https://site.com/panel/live-edit?src=https%3A%2F%2Fsite.com%2Ffaq%23top&slug=pages&id=1
 * ```
 */
export const setLiveUrl = Hooks.beforeRead<'generic'>(async function setLiveUrl(args) {
  const { config, event, context } = args;
  const doc = args.doc;
  if (!config.live || !event.locals.user?.isStaff || !doc.url) return args;

  const params = new URLSearchParams({ src: doc.url, slug: config.slug, id: doc.id });
  if (doc.contentId) params.set(PARAMS.VERSION_ID, doc.contentId);
  if (context.params.locale) params.set(PARAMS.LOCALE, context.params.locale);
  // One slash between the site and the panel, whether SITE_URL ends in one or not
  const live = `${SITE_URL.replace(/\/$/, '')}/${RIME_PANEL_ROUTE}/live-edit?${params}`;
  return { ...args, doc: { ...doc, _live: live } };
});
