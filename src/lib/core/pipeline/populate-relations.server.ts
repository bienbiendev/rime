import type { DocumentRows } from '$lib/core/adapter.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * The documents a list's relations point at, keyed by `populatedKey`.
 *
 * Read for one operation, by one reader, and dropped with it.
 */
export type Populated = Map<string, GenericDoc>;

export const populatedKey = (slug: string, locale: string | undefined, id: string) =>
  `${slug}:${locale ?? ''}:${id}`;

/**
 * Reads what the relations of a whole list point at, one `findByIds` per collection and locale.
 *
 * ```ts
 * // 20 pages, 2 relations each, 22 distinct targets
 * // 40 × findById  ->  1 × findByIds({ ids: [...22] })
 * ```
 *
 * A relation row keeps its own locale, or none: the target is read in that locale, else in the
 * request's, as `findById` would. A target that is missing or refused to this reader is absent
 * from the map.
 */
export const populateRelations = async (
  rows: DocumentRows[],
  args: { event: RequestEvent; locale?: string; depth: number }
): Promise<Populated> => {
  const { event, locale, depth } = args;
  const groups = new Map<string, { slug: CollectionSlug; locale?: string; ids: Set<string> }>();

  for (const relation of rows.flatMap((row) => row.relations)) {
    if (!relation.documentId) continue;
    // A row written in another locale is not part of this read.
    if (relation.locale && relation.locale !== locale) continue;

    const key = `${relation.relationTo}:${relation.locale ?? ''}`;
    const group = groups.get(key) ?? {
      slug: relation.relationTo as CollectionSlug,
      locale: relation.locale ?? undefined,
      ids: new Set<string>()
    };
    group.ids.add(relation.documentId);
    groups.set(key, group);
  }

  const populated: Populated = new Map();

  await Promise.all(
    [...groups.values()].map(async (group) => {
      const docs = await event.locals.rime
        .collection(group.slug)
        .findByIds({ ids: [...group.ids], locale: group.locale, depth: depth - 1 });
      for (const doc of docs) {
        populated.set(populatedKey(group.slug, group.locale, doc.id), doc);
      }
    })
  );

  return populated;
};
