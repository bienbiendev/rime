import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { withVersionsSuffix } from './naming.js';
import type { AutoSave, AutoSaves } from './types.js';

/**
 * The auto-saved rows of a document, newest first.
 *
 * Read as rime itself: the rows are staff-only, and the caller may hold the document open with
 * read access alone. `undefined` on a config that does not auto-save, so a page can tell "none"
 * from "not a thing here".
 */
export const autoSavesOf = async (args: {
  event: RequestEvent;
  config: BuiltCollection | BuiltArea;
  doc: GenericDoc;
}): Promise<AutoSaves | undefined> => {
  const { event, config, doc } = args;
  if (!config.versions?.autoSave) return undefined;

  const versionsSlug = withVersionsSuffix(config.slug) as CollectionSlug;

  const rows = (await event.locals.rime
    .collection(versionsSlug)
    .system()
    .find({
      query: {
        where: { and: [{ ownerId: { equals: doc.id } }, { isAutoSave: { equals: true } }] }
      },
      select: ['id', 'updatedAt', 'updatedBy'],
      sort: '-updatedAt'
    })) as unknown as AutoSave[];

  return rows.map(({ id, updatedAt, updatedBy }) => ({
    id,
    updatedAt,
    updatedBy: updatedBy ?? null
  }));
};
