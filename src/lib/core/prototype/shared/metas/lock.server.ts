import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { isLockHeldByOther } from './lock.js';

type LockArgs = {
  event: RequestEvent;
  config: BuiltCollection | BuiltArea;
  /** The document being edited. Its `versionId`, when it has one, is the row the claim sits on. */
  doc: Partial<GenericDoc>;
  userId: string;
};

/**
 * Write the lock fields and nothing else, on the row being edited.
 *
 * **Which row.** The lock is not `._root()`, so on a versioned config it lives with the content —
 * one claim per revision. Two people on two different versions are not editing the same thing, and
 * locking one must not lock the other. Where there are no versions there is one row and this
 * resolves to it.
 *
 * **`updateWhere` rather than `update`**: a table, a filter and a patch, writing exactly the
 * columns it is given. Opening a document is not editing it, so the write leaves `updatedAt` where
 * it is and never runs the pipeline — which would stamp `updatedBy` and cut a revision whose only
 * change is who is looking at it.
 */
const writeLock = async (args: LockArgs, data: { currentlyEditedBy: string | null }) => {
  const { event, config, doc } = args;
  const { rime } = event.locals;

  const versionsSlug = config._versions?.slug;
  const target =
    versionsSlug && doc.versionId
      ? { handle: rime.adapter.collection(versionsSlug), id: doc.versionId }
      : {
          handle: rime.config.isCollection(config.slug)
            ? rime.adapter.collection(config.slug)
            : rime.adapter.area(config.slug),
          id: doc.id
        };

  await target.handle.updateWhere({
    query: `where[id][equals]=${target.id}`,
    data: {
      ...data,
      currentlyEditedAt: data.currentlyEditedBy ? new Date() : null
    }
  });
};

/**
 * Take the document, unless somebody else holds it.
 *
 * Also the renewal: a claim we already hold is rewritten with a fresh timestamp, which is what
 * keeps a lock alive while its holder is still in the document. Answers whether the caller holds
 * it afterwards.
 *
 * `force` takes it regardless — the *Take control* button, which exists to get past a claim
 * somebody walked away from before it ages out.
 */
export const claimEditLock = async (args: LockArgs & { force?: boolean }) => {
  if (!args.force && isLockHeldByOther(args.doc, args.userId)) return false;

  await writeLock(args, { currentlyEditedBy: args.userId });
  return true;
};

/**
 * Give the document back, if it is ours to give.
 *
 * The `doc` guard matters: a release racing somebody else's claim would otherwise hand them a
 * document with no lock on it a moment after they took it.
 */
export const releaseEditLock = async (args: LockArgs) => {
  if (args.doc.currentlyEditedBy !== args.userId) return false;

  await writeLock(args, { currentlyEditedBy: null });
  return true;
};
