/**
 * How long a claim on a document stays good without being renewed.
 *
 * The lock exists to stop two people overwriting each other, not to reserve a document — so it has
 * to expire. `editedBy` had no expiry and no release: whoever pressed *Take control* held the
 * document until somebody else pressed it, which on a real install means either nobody ever sees
 * the overlay or nobody can get past it.
 */
export const EDIT_LOCK_TTL_MS = 5 * 60 * 1000;

/** The fields that hold the claim, and nothing else. */
export const EDIT_LOCK_FIELDS = ['currentlyEditedBy', 'currentlyEditedAt'] as const;
