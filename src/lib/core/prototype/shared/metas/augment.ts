import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Collection } from '$lib/core/config/types.js';

type Input = { fields?: Collection<any>['fields'] };

/**
 * The bookkeeping every document carries: when it was written, and by whom.
 *
 * `editedBy` was one field doing three jobs — it held a user id, was named as if it held a date,
 * and meant "someone has this document open right now" while sitting in the same shape as a value
 * that means "this is who made it". The three are separated here, and only one of them is
 * ephemeral.
 *
 * **Why `createdBy` and the lock are `._root()` and `lastEditedBy` is not.** On a versioned config
 * the schema generator sends `._root()` fields to the base row and everything else to the versions
 * table (`adapter-sqlite/generate-schema/index.server.ts`). Each of these lands where the question
 * it answers belongs:
 *
 * - `createdBy` — who made *the document*. One answer, whatever its revision history.
 * - `currentlyEditedBy` / `currentlyEditedAt` — who holds the document open, and since when. On
 *   the base row so that claiming or releasing a lock is a write to the document rather than a new
 *   version of it: `editedBy` was a content field, so `takeControl`'s PATCH spawned a revision
 *   whose only change was who was looking at it.
 * - `lastEditedBy` — who wrote *this revision*. Per version, and on an unversioned config there is
 *   only one row, so it reads the same either way.
 *
 * They are `text`, not relations to `staff`, and that is not a preference: the base table is built
 * from `fields.filter(field => field.get.root)` in a call whose `relationFieldsMap` is discarded,
 * so a `._root()` relation generates no junction table and silently stores nothing. The panel
 * resolves an id to a name where it shows one.
 */
export const augmentMetas = <T extends Input>(config: T): T => {
  const fields = [...(config.fields || [])];
  fields.push(
    //
    text('createdBy').hidden()._root(),
    text('lastEditedBy').hidden(),
    text('currentlyEditedBy').hidden()._root(),
    date('currentlyEditedAt').hidden()._root(),
    date('createdAt').hidden(),
    date('updatedAt').hidden()
  );
  return { ...config, fields };
};
