import type { BuiltCollection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { refreshUrls } from '../refresh.server.js';

/**
 * Before a delete, the page's children go to the top level with their subtrees, as `_parent`
 * does, and get their new urls. The page's own rows go with it by cascade.
 */
export const detachPaths = Hooks.beforeDelete<'generic'>(async function detachPaths(args) {
  const { event, doc } = args;
  const config = args.config as BuiltCollection;
  const detached = await event.locals.rime.adapter.paths.detachChildren({
    slug: config.slug,
    ownerId: doc.id
  });
  for (const row of detached) {
    await refreshUrls({ event, config, locale: row.locale, path: row.path });
  }
  return args;
});
