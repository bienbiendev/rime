import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { withoutUnreadableFields } from './hooks/process-document-fields.server.js';

/**
 * What the request user may see of a document a write answers with: its id alone when the
 * prototype's `read` refuses them, else the document without the fields they may not read.
 *
 * ```ts
 * // contacts: create () => true, read left to isStaff — an anonymous create
 * seenBy({ event, config, doc }); // { id: 'c1' }
 * ```
 *
 * The check is the one a read makes, with the same arguments.
 */
export const seenBy = <T extends GenericDoc>(args: {
  event: RequestEvent;
  config: BuiltCollection | BuiltArea;
  doc: T;
}): T => {
  const { event, config, doc } = args;
  const user = event.locals.user;
  if (!config.access.read(user, { event, id: doc.id })) return { id: doc.id } as T;
  return withoutUnreadableFields(doc, config.fields, user);
};
