import { Hooks } from '$lib/core/pipeline/define-hook.js';

/**
 * Drops the edit lock from every read that is not a panel read.
 *
 * The fields already carry `.access({ read: isStaff })`, which answers "who may see a lock" —
 * a different question from "where does a lock mean anything". It only means something in the
 * panel, and a staff member reading through the API is still staff, so the field access alone
 * would hand them a lock they cannot act on.
 */
export const deletePanelLockMetas = Hooks.beforeRead(async (args) => {
  const { rime } = args.event.locals;

  if (args.context.isSystemOperation) return args;
  if (rime.routes.isPanel) return args;

  const doc = args.doc;
  delete doc.currentlyEditedBy;
  delete doc.currentlyEditedAt;
  return { ...args, doc };
});
