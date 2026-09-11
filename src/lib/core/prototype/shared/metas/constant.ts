/**
 * How long a claim on a document stays good without being renewed.
 *
 * The lock stops two people overwriting each other; it does not reserve a document. Nothing
 * releases a claim when an editor walks away, so the expiry is what keeps an abandoned one from
 * stranding the document behind whoever opened it.
 */
export const EDIT_LOCK_TTL_MS = 5 * 60 * 1000;

/** The fields that hold the claim, and nothing else. */
export const EDIT_LOCK_FIELDS = ['currentlyEditedBy', 'currentlyEditedAt'] as const;
