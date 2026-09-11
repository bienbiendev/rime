import type { Collection } from '$lib/core/config/types.js';
import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';

type Input = { fields?: Collection<any>['fields'] };

/**
 * The bookkeeping every document carries: when it was written, and by whom.
 *
 * Three separate questions about who, because each has its own lifetime — one is written once,
 * one on every write, and one is ephemeral:
 *
 * - `createdBy` — who made *the document*. One answer, whatever its revision history.
 * - `updatedBy` — who wrote *this revision*.
 * - `currentlyEditedBy` / `currentlyEditedAt` — who holds the document open, and since when.
 *
 * **Which of them are `._root()`.** On a versioned config the schema generator sends `._root()`
 * fields to the base row and everything else to the versions table
 * (`adapter-sqlite/generate-schema/index.server.ts`), so each lands where the question it answers
 * belongs. `createdBy` and the lock are properties of the document, so they sit on the base row —
 * which also means claiming the lock is a write to the document and not a new version of it.
 * `updatedBy` is a property of the revision, so it rides with the content; on an unversioned
 * config there is one row and it reads the same either way.
 *
 * **Why `text` and not relations to `staff`.** The base table is built from
 * `fields.filter(field => field.get.root)` in a `buildRootTable` call whose `relationFieldsMap`
 * the caller discards, so a `._root()` relation generates no junction table and silently stores
 * nothing. The panel resolves an id to a name where it shows one.
 */
export const augmentMetas = <T extends Input>(config: T): T => {
  const fields = [...(config.fields || [])];
  fields.push(
    //
    text('createdBy').hidden()._root(),
    text('updatedBy').hidden(),
    text('currentlyEditedBy').hidden()._root(),
    date('currentlyEditedAt').hidden()._root(),
    date('createdAt').hidden(),
    date('updatedAt').hidden()
  );
  return { ...config, fields };
};
