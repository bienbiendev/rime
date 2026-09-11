/**
 * How long a claim on a document stays good without being renewed.
 *
 * The lock stops two people overwriting each other; it does not reserve a document. Nothing
 * releases a claim when an editor walks away, so the expiry is what keeps an abandoned one from
 * stranding the document behind whoever opened it.
 */
export const EDIT_LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * How long a claim survives the tab going away.
 *
 * A release is a short lease, not a hand-back: a refresh unloads the page and reclaims it a
 * moment later, and clearing the claim outright leaves a window where another tab's renewal
 * takes the document from someone who never left.
 */
export const EDIT_LOCK_TTL_AFTER_CLOSE_MS = 10 * 1000;
