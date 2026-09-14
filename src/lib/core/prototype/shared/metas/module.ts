import type { Collection } from '$lib/core/config/types.js';
import { metasFields } from './fields.js';

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
 * **Which of them are `$root()`.** On a versioned config the schema generator sends `$root()`
 * fields to the base row and everything else to the versions table
 * (`adapter-sqlite/generate-schema/index.server.ts`), so each lands where the question it answers
 * belongs. `createdBy` is a property of the document — one answer per document, whatever its
 * revisions — so it sits on the base row. `updatedBy` and the lock are properties of a *revision*:
 * two people on two different versions are not editing the same thing, so locking one must not
 * lock the other.
 *
 * **Text columns, read back as the staff member.** Each of the three ids is a `text` column the
 * server half marks `$references('staff', { resolve: true })`: the adapter joins the target on
 * read, so the document carries `{ id, name, email }` on the same key and the panel has a name to
 * show. A write takes that object or the id. A text column is also what can be `$root()`, which
 * a relation field cannot.
 *
 * **The lock is staff-only, said on the field.** `.access({ read, update })` is enforced by the
 * pipeline for every caller — `processDocumentFields` drops what a reader may not see,
 * `validateFields` drops what a writer may not set — so who can see and claim a lock is one
 * declaration here rather than a rule each read path has to remember.
 *
 * The client half. `module.server.ts` adds the reference to `staff` on the three id columns,
 * which is what decides what happens to a document whose author is deleted.
 */
export const augmentMetas = <T extends Input>(config: T): T => {
  const fields = [...(config.fields || [])];
  fields.push(
    metasFields.createdBy(),
    metasFields.updatedBy(),
    metasFields.currentlyEditedBy(),
    metasFields.currentlyEditedAt(),
    metasFields.createdAt(),
    metasFields.updatedAt()
  );
  return { ...config, fields };
};
