import type { PathRow } from '$lib/core/adapter.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { formatUrl } from './format.server.js';

/**
 * The documents of these pages in `locale`: the published ones, and the newest version of those
 * never published. A url is built from them.
 */
export const readForUrls = async (args: {
  event: RequestEvent;
  config: BuiltCollection;
  locale: string;
  ids: string[];
}): Promise<Map<string, GenericDoc>> => {
  const { event, config, locale, ids } = args;
  const collection = event.locals.rime.collection(config.slug as CollectionSlug).system();
  const query = (list: string[]) => ({ where: { id: { in_array: list } } });

  const docs = new Map<string, GenericDoc>();
  for (const doc of await collection.find({ query: query(ids), locale: locale || undefined })) {
    docs.set(doc.id, doc);
  }
  const missing = ids.filter((id) => !docs.has(id));
  if (missing.length && config.versions?.draft) {
    const newest = await collection.find({
      query: query(missing),
      locale: locale || undefined,
      latest: true
    });
    for (const doc of newest) docs.set(doc.id, doc);
  }
  return docs;
};

/**
 * Formats the urls of these rows, one locale, and writes those that changed in one go. `docs` are
 * the pages' documents when the caller has them already.
 */
export const formatRows = async (args: {
  event: RequestEvent;
  config: BuiltCollection;
  locale: string;
  rows: PathRow[];
  docs?: Map<string, GenericDoc>;
}) => {
  const { event, config, locale, rows } = args;
  if (!rows.length) return;

  const docs =
    args.docs ??
    (await readForUrls({ event, config, locale, ids: rows.map((row) => row.ownerId) }));
  const changed = rows.flatMap((row) => {
    const doc = docs.get(row.ownerId);
    if (!doc) return [];
    const url = formatUrl({ config, doc, path: row.path, locale });
    return url === row.url ? [] : [{ ownerId: row.ownerId, locale, url }];
  });

  await event.locals.rime.adapter.paths.setUrls({ slug: config.slug, rows: changed });
};

/**
 * The urls of the page at `path` and, unless told otherwise, of every page under it, in one
 * locale: their documents in one `find`, the changed urls in one write.
 */
export const refreshUrls = async (args: {
  event: RequestEvent;
  config: BuiltCollection;
  locale: string;
  path: string;
  withDescendants?: boolean;
}) => {
  const { event, config, locale, path, withDescendants } = args;
  const rows = await event.locals.rime.adapter.paths.under({
    slug: config.slug,
    locale,
    path,
    withDescendants
  });
  await formatRows({ event, config, locale, rows });
};
