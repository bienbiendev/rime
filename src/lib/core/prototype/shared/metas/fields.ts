import { isStaff } from '$lib/core/auth/access.js';
import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
import type { FieldAccess } from '$lib/fields/types.js';

/**
 * The metas fields, declared once for both halves of the module.
 *
 * Factories, not instances: a builder is mutable and ends up on one config's field list, so the
 * two halves share the declaration rather than the object. `module.server.ts` calls the same
 * factories and adds the foreign key to `staff` on the three id columns.
 */

/**
 * Who wrote a document and who is holding it open are staff business. Said on the field, so the
 * pipeline enforces it for every caller — `processDocumentFields` drops what a reader may not
 * see, `validateFields` drops what a writer may not set — rather than each read path remembering.
 */
const staffOnly: { read: FieldAccess; update: FieldAccess } = {
  read: (user) => isStaff(user),
  update: (user) => isStaff(user)
};

export const metasFields = {
  createdBy: () => text('createdBy').hidden().$root().access(staffOnly),
  updatedBy: () => text('updatedBy').hidden().access(staffOnly),
  currentlyEditedBy: () => text('currentlyEditedBy').hidden().access(staffOnly),
  currentlyEditedAt: () => date('currentlyEditedAt').hidden().access(staffOnly),
  createdAt: () => date('createdAt').hidden(),
  updatedAt: () => date('updatedAt').hidden()
};
