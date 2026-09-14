import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { withVersionsSuffix } from './naming.js';

/**
 * Deletes a user's auto-saved rows — of one document, or of every document of the config when
 * `docId` is not given — except `keep`.
 *
 * Bookkeeping, so it runs as rime itself: an editor retiring their own auto-saves need not hold
 * `access.delete`. `keep` is the row a save just landed on.
 */
export const retireAutoSaves = async (args: {
  event: RequestEvent;
  config: BuiltCollection | BuiltArea;
  userId: string;
  docId?: string;
  keep?: string;
}): Promise<string[]> => {
  const { event, config, docId, userId, keep } = args;
  if (!config.versions?.autoSave) return [];

  const versionsSlug = withVersionsSuffix(config.slug) as CollectionSlug;

  return event.locals.rime
    .collection(versionsSlug)
    .system()
    .delete({
      query: {
        where: {
          and: [
            { isAutoSave: { equals: true } },
            { updatedBy: { equals: userId } },
            ...(docId ? [{ ownerId: { equals: docId } }] : []),
            ...(keep ? [{ id: { not_equals: keep } }] : [])
          ]
        }
      }
    });
};
