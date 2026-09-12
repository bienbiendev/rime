import { STAFF_SLUG } from '$lib/core/auth/tables.js';
import type { text } from '$lib/fields/text/index.js';
import type { Collection } from '$lib/core/config/types.js';
import { metasFields } from './fields.js';

type Input = { slug?: string; fields?: Collection<any>['fields'] };

/**
 * The metas' server half: the same fields, carrying a foreign key to `staff`.
 *
 * **A column with a reference, not a relation field.** A `relation('createdBy').to('staff')` would
 * store the id in the junction table, one row per document per field — so the answer to "who made
 * this" would not be visible beside the document in any database view, and reading it would cost a
 * join the panel's list does per row. A `text` column with `$references` puts the id in the row
 * itself and still gets referential integrity out of the database.
 *
 * **`resolve: true` is what puts a name in the panel.** The adapter joins the staff member on
 * read and the document carries `{ id, name, email }` where the id column is; the pipeline
 * writes the id back.
 *
 * **`onDelete: 'set null'` is the policy for a deleted user**, and it is the reason this half
 * exists at all. Without a reference, deleting a staff member leaves their id behind on every
 * document they touched, pointing at nothing — the panel renders a dash and the database cannot
 * tell you the row is stale. `set null` says it plainly: the documents outlive their author and
 * lose the attribution. A config where documents genuinely should not outlive their owner wants
 * `cascade` instead, and that is a one-word change here rather than a cleanup job.
 *
 * The reference has to be on the builder at construction, which is why this is written out rather
 * than wrapping the client half — the same reason `nested/module.server.ts` is.
 */
export const augmentMetas = <T extends Input>(config: T): T => {
  const fields = [...(config.fields || [])];

  // The staff collection's own metas cannot reference the table they sit on without a
  // self-referencing accessor; it is also the one collection where "who made this user" is
  // answered by the bootstrap rather than a person.
  const staffRef = (field: ReturnType<typeof text>) =>
    field.$references(STAFF_SLUG, {
      onDelete: 'set null',
      resolve: true,
      selfReferencing: config.slug === STAFF_SLUG
    });

  fields.push(
    staffRef(metasFields.createdBy()),
    staffRef(metasFields.updatedBy()),
    staffRef(metasFields.currentlyEditedBy()),
    metasFields.currentlyEditedAt(),
    metasFields.createdAt(),
    metasFields.updatedAt()
  );

  return { ...config, fields };
};
