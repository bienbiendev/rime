import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { withVersionsSuffix } from './naming.js';
import type { AutoSaves } from './types.js';

/** What the read below selects off an auto-saved row. */
type AutoSaveRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: AutoSaves['others'][number]['updatedBy'];
};

/**
 * The auto-saved rows of a document, split into the caller's and everybody else's.
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
  const userId = event.locals.user?.id;

  const rows = (await event.locals.rime
    .collection(versionsSlug)
    .system()
    .find({
      query: {
        where: { and: [{ ownerId: { equals: doc.id } }, { isAutoSave: { equals: true } }] }
      },
      select: ['id', 'createdAt', 'updatedAt', 'updatedBy'],
      sort: '-updatedAt'
    })) as unknown as AutoSaveRow[];

  const own = rows.find((row) => row.updatedBy?.id === userId);
  const others = rows
    .filter((row) => row !== own)
    .map(({ id, updatedAt, updatedBy }) => ({ id, updatedAt, updatedBy: updatedBy ?? null }));

  return {
    own: own && {
      id: own.id,
      createdAt: own.createdAt,
      updatedAt: own.updatedAt,
      outdated: new Date(doc.updatedAt!).getTime() > new Date(own.createdAt).getTime()
    },
    others
  };
};
