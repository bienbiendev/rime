import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { logger } from '$lib/core/logger.server.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { EDIT_LOCK_TTL_AFTER_CLOSE_MS, EDIT_LOCK_TTL_MS } from './constant.js';
import { isLockHeldByOther, lockHolderId } from './lock.js';

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
 * **Which row.** The lock is not `$root()`, so on a versioned config it lives with the content —
 * one claim per revision. Two people on two different versions are not editing the same thing, and
 * locking one must not lock the other. Where there are no versions there is one row and this
 * resolves to it.
 *
 * **`updateWhere` rather than `update`**: a table, a filter and a patch, writing exactly the
 * columns it is given. Opening a document is not editing it, so the write leaves `updatedAt` where
 * it is and never runs the pipeline — which would stamp `updatedBy` and cut a revision whose only
 * change is who is looking at it.
 */
const writeLock = async (
  args: LockArgs,
  data: { currentlyEditedBy: string | null; currentlyEditedAt: Date | null }
) => {
  const { event, config, doc } = args;
  const { rime } = event.locals;

  const versionsSlug = config._versions?.slug;

  // A versioned config keeps these columns on its versions table and nowhere else — they are not
  // `$root()`. Writing to the base row would target columns that table does not have, so a
  // versioned document with no `versionId` is a caller bug, not a row to guess at.
  if (versionsSlug && !doc.versionId) {
    logger.warn(`edit lock on ${config.slug}: versioned document with no versionId, ignored`);
    return;
  }

  const id = versionsSlug ? doc.versionId! : doc.id;

  await rime.adapter.contentOwner(config.slug).updateWhere({
    query: `where[id][equals]=${id}`,
    data
  });

  // Tell whoever else has the document open, so they reload — for the overlay, and for the
  // content, which the holder has usually just changed. Only when the lock actually changed
  // hands: a claim is also the renewal, and those would reach every client twice a TTL.
  if (lockHolderId(doc) !== data.currentlyEditedBy) {
    // Keyed on the document's own id, not the version row's — it is what the panel subscribed to.
    rime.sse.emit(`rime:${config.slug}:${doc.id}`, 'rime:lock');
  }
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

  await writeLock(args, { currentlyEditedBy: args.userId, currentlyEditedAt: new Date() });
  return true;
};

/**
 * Give the document back, if it is ours to give — as a short lease rather than a hand-back.
 *
 * The claim keeps our name and is back-dated to expire in `EDIT_LOCK_TTL_AFTER_CLOSE_MS`, so a
 * refresh has time to reclaim it. Clearing it outright is what let another tab's renewal take the
 * document from someone who only reloaded.
 *
 * The `doc` guard matters: a release racing somebody else's claim would otherwise hand them a
 * document with no lock on it a moment after they took it.
 */
export const releaseEditLock = async (args: LockArgs) => {
  if (lockHolderId(args.doc) !== args.userId) return false;

  await writeLock(args, {
    currentlyEditedBy: args.userId,
    currentlyEditedAt: new Date(Date.now() - EDIT_LOCK_TTL_MS + EDIT_LOCK_TTL_AFTER_CLOSE_MS)
  });
  return true;
};
