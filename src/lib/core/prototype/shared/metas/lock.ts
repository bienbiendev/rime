import type { GenericDoc } from '$lib/core/prototype/types.js';
import { EDIT_LOCK_TTL_MS } from './constant.js';

/**
 * Reading a claim. Pure, and in the isomorphic half on purpose: the server decides whether to
 * grant a claim and the panel decides whether to draw the overlay, and the two have to agree on
 * what "held" means.
 */

/** A claim older than the TTL says nothing: whoever made it is not coming back. */
export const isLockStale = (at: unknown, now = Date.now()) => {
  if (!at) return true;
  const since = at instanceof Date ? at.getTime() : new Date(at as string).getTime();
  return Number.isNaN(since) || now - since >= EDIT_LOCK_TTL_MS;
};

/** Somebody other than `userId` is in this document, recently enough to still mean it. */
export const isLockHeldByOther = (doc: Partial<GenericDoc>, userId: string, now = Date.now()) => {
  const by = doc.currentlyEditedBy;
  return !!by && by !== userId && !isLockStale(doc.currentlyEditedAt, now);
};
