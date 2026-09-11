import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { EDIT_LOCK_FIELDS } from '../constant.js';

/**
 * Records who made a document, and who last wrote to it.
 *
 * Two hooks rather than one `beforeUpsert`, because they do not write the same fields: a create
 * answers both questions at once, an update only the second. `createdBy` is never rewritten —
 * that is the whole difference between it and `lastEditedBy`.
 *
 * **Both stand down without a user, and on a system operation.** Rime writes as itself when it
 * bootstraps a singleton, propagates a document into the other locales, or migrates. None of
 * those is somebody editing, and stamping them would name whoever's request happened to trigger
 * the work as the author of documents they never touched.
 */

/** Who is writing, when that is a person and not rime itself. */
const editor = (args: {
  event: { locals: { user?: { id: string } | undefined } };
  context: { isSystemOperation?: boolean };
}) => (args.context.isSystemOperation ? undefined : args.event.locals.user?.id);

export const stampCreatedBy = Hooks.beforeCreate(async function stampCreatedBy(args) {
  const by = editor(args);
  if (!by) return args;

  return { ...args, data: { ...args.data, createdBy: by, lastEditedBy: by } };
});

/**
 * Claiming or releasing the edit lock is not editing: `takeControl` PATCHes nothing but the lock,
 * and stamping that would name whoever opened the document as its last author.
 */
const isLockOnlyWrite = (data: object) => {
  const keys = Object.keys(data);
  return (
    keys.length > 0 && keys.every((key) => (EDIT_LOCK_FIELDS as readonly string[]).includes(key))
  );
};

export const stampLastEditedBy = Hooks.beforeUpdate(async function stampLastEditedBy(args) {
  const by = editor(args);
  if (!by) return args;
  if (isLockOnlyWrite(args.data)) return args;

  return { ...args, data: { ...args.data, lastEditedBy: by } };
});
