import { isStaff } from '$lib/core/auth/access.js';
import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Collection } from '$lib/core/config/types.js';

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
 * belongs. `createdBy` is a property of the document — one answer per document, whatever its
 * revisions — so it sits on the base row. `updatedBy` and the lock are properties of a *revision*:
 * two people on two different versions are not editing the same thing, so locking one must not
 * lock the other.
 *
 * **Why `text` and not relations to `staff`.** The base table is built from
 * `fields.filter(field => field.get.root)` in a `buildRootTable` call whose `relationFieldsMap`
 * the caller discards, so a `._root()` relation generates no junction table and silently stores
 * nothing. The panel resolves an id to a name where it shows one.
 *
 * **The lock is staff-only, said on the field.** `.access({ read, update })` is enforced by the
 * pipeline for every caller — `processDocumentFields` drops what a reader may not see,
 * `validateFields` drops what a writer may not set — so who can see and claim a lock is one
 * declaration here rather than a rule each read path has to remember.
 *
 * The client half. `module.server.ts` adds the foreign key to `staff` on the three id columns,
 * which is what decides what happens to a document whose author is deleted.
 */
export const augmentMetas = <T extends Input>(config: T): T => {
  const fields = [...(config.fields || [])];
  fields.push(
    //
    text('createdBy').hidden()._root(),
    text('updatedBy').hidden(),
    text('currentlyEditedBy')
      .hidden()
      .access({ read: (user) => isStaff(user), update: (user) => isStaff(user) }),
    date('currentlyEditedAt')
      .hidden()
      .access({ read: (user) => isStaff(user), update: (user) => isStaff(user) }),
    date('createdAt').hidden(),
    date('updatedAt').hidden()
  );
  return { ...config, fields };
};
