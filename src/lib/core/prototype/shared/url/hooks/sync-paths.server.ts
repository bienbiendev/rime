import type { BuiltCollection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { isNested } from '$lib/core/prototype/collection/nested/enabled.js';
import { addAddresses, movePage, withAddress } from '../addresses.server.js';
import { refreshUrls } from '../refresh.server.js';

/**
 * After a save. A move carries the page and its subtree under the new parent, in every locale,
 * with a free slug there. Any other save formats the page's own urls again, since `$url` may read
 * any of its fields.
 *
 * An auto-save moves nothing and changes no url: it is skipped.
 */
export const syncPaths = Hooks.afterUpdate<'generic'>(async function syncPaths(args) {
  const { event, doc, context } = args;
  const config = args.config as BuiltCollection;
  const { paths } = event.locals.rime.adapter;
  if (context.params.autoSave) return args;

  const parentId = (doc._parent as string | null | undefined) ?? null;
  const wasUnder = (context.originalDoc?._parent as string | null | undefined) ?? null;
  const moved = isNested(config) && parentId !== wasUnder;

  const rows = moved
    ? await movePage({ event, config, ownerId: doc.id, parentId })
    : await paths.get({ slug: config.slug, ownerId: doc.id });

  // A page saved before it had an address gets one.
  if (!rows.length) {
    await addAddresses({ event, config, ids: [doc.id] });
  }
  for (const row of rows) {
    await refreshUrls({
      event,
      config,
      locale: row.locale,
      path: row.path,
      withDescendants: moved
    });
  }
  return { ...args, doc: await withAddress({ event, config, doc }) };
});
