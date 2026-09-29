import type { BuiltCollection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { movePage } from '../addresses.server.js';
import { refreshUrls } from '../refresh.server.js';

/**
 * Before a delete, the page's children go to the top with their subtrees, as `_parent` does, and
 * get their new urls. A child whose slug a top page holds takes the next free one. The page's own
 * rows go with it by cascade.
 */
export const detachPaths = Hooks.beforeDelete<'generic'>(async function detachPaths(args) {
  const { event, doc } = args;
  const config = args.config as BuiltCollection;
  const { paths } = event.locals.rime.adapter;
  for (const ownerId of await paths.children({ slug: config.slug, ownerId: doc.id })) {
    for (const row of await movePage({ event, config, ownerId, parentId: null })) {
      await refreshUrls({ event, config, locale: row.locale, path: row.path });
    }
  }
  return args;
});
