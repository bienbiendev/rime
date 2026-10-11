import { isStaff } from '#lib/core/auth/access.js';
import type { User } from '#lib/core/auth/types.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';

/**
 * Records which staff member made a document, and which one last wrote to it.
 *
 * Two hooks rather than one `beforeUpsert`, because they do not write the same fields: a create
 * answers both questions at once, an update only the second. `createdBy` is never rewritten —
 * that is the whole difference between it and `updatedBy`.
 *
 * **Both stand down without a staff member, and on a `.system()` call.** The columns reference
 * `staff`, so a member of another auth collection is not recorded.
 */

/** Who is writing, when that is a staff member and not rime itself: the columns name staff. */
const editor = (args: {
  event: { locals: { user?: User | undefined } };
  context: { isSystemOperation?: boolean };
}) => {
  const { user } = args.event.locals;
  if (args.context.isSystemOperation || !isStaff(user)) return undefined;
  return user!.id;
};

export const stampCreatedBy = Hooks.beforeCreate(async function stampCreatedBy(args) {
  const by = editor(args);
  if (!by) return args;

  return { ...args, data: { ...args.data, createdBy: by, updatedBy: by } };
});

export const stampUpdatedBy = Hooks.beforeUpdate(async function stampUpdatedBy(args) {
  const by = editor(args);
  if (!by) return args;

  return { ...args, data: { ...args.data, updatedBy: by } };
});
