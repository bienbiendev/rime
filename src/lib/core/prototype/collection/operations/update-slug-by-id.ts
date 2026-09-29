import type { PathRow } from '$lib/core/adapter.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { RimeError, RimeFormError } from '$lib/core/errors/index.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import { toSlug } from '$lib/core/prototype/shared/url/format.server.js';
import { refreshUrls } from '$lib/core/prototype/shared/url/refresh.server.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';

export type UpdateSlugByIdArgs = {
  id: string;
  slug: string;
  /** The locale whose address changes; the others keep theirs. */
  locale?: string | undefined;
};

type Args = UpdateSlugByIdArgs & { ctx: PrototypeApiContext<BuiltCollection> };

/**
 * A page's slug in one locale: its address changes, and the pages under it follow.
 *
 * On the published page only, for whoever may update it. A slug a sibling holds is refused as a
 * field error on `_slug`.
 */
export const updateSlugById = async (args: Args): Promise<PathRow> => {
  const { ctx, id } = args;
  const { config, event, isSystemOperation } = ctx;
  const { rime } = event.locals;
  const locale = args.locale ?? '';

  if (!config.$url) {
    throw new RimeError(RimeError.BAD_REQUEST, `${config.slug} has no $url, so no slug`);
  }
  if (!isSystemOperation && !config.access.update(event.locals.user, { event, id })) {
    throw new RimeError(RimeError.UNAUTHORIZED);
  }

  const collection = rime.collection(config.slug as CollectionSlug).system();
  const byId = { where: { id: { equals: id } } };
  // Without `latest`, a read with drafts answers the published version only.
  const [page] = await collection.find({ query: byId, locale: locale || undefined });
  if (!page) {
    const [draft] = await collection.find({
      query: byId,
      locale: locale || undefined,
      latest: true
    });
    if (!draft) throw new RimeError(RimeError.NOT_FOUND);
    throw new RimeError(RimeError.BAD_REQUEST, 'the slug changes on the published page');
  }

  const value = toSlug(args.slug);
  if (!value) throw new RimeFormError({ _slug: RimeFormError.REQUIRED_FIELD });

  const [current] = await rime.adapter.paths.get({ slug: config.slug, ownerId: id, locale });
  if (!current) throw new RimeError(RimeError.NOT_FOUND);
  if (current.slug === value) return current;

  const parentId = (page._parent as string | null | undefined) ?? null;
  const taken = await rime.adapter.paths.siblingSlugs({ slug: config.slug, locale, parentId });
  if (taken.includes(value)) throw new RimeFormError({ _slug: RimeFormError.UNIQUE_FIELD });

  const row = await rime.adapter.paths.setSlug({ slug: config.slug, ownerId: id, locale, value });
  if (!row) throw new RimeError(RimeError.NOT_FOUND);
  await refreshUrls({ event, config, locale, path: row.path });

  const [updated] = await rime.adapter.paths.get({ slug: config.slug, ownerId: id, locale });
  return updated;
};
