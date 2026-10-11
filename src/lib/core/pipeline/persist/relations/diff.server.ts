import type { BeforeOperationRelation, RelationRow } from '#lib/fields/relation/index.js';

export type RelationDiff = {
  toAdd: BeforeOperationRelation[];
  toDelete: RelationRow[];
  toUpdate: RelationRow[];
};

type Args = {
  existingRelations: RelationRow[];
  incomingRelations: BeforeOperationRelation[];
  locale?: string;
};

/** No locale on either side reads as `null`. */
const sameLocale = (existing: RelationRow, incoming: BeforeOperationRelation) =>
  (existing.locale ?? null) === (incoming.locale ?? null);

const needUpdate = (existing: RelationRow, incoming: BeforeOperationRelation) =>
  existing.position !== incoming.position ||
  existing.documentId !== incoming.documentId ||
  existing.path !== incoming.path ||
  !sameLocale(existing, incoming);

/**
 * The rows to add, update and delete so the stored relations become the incoming ones.
 *
 * ```ts
 * // stored: { id: 'r1', path: 'image', documentId: 'm1' }
 * defineRelationsDiff({ existingRelations, incomingRelations: [{ id: 'r1', path: 'image', documentId: 'm2', … }] })
 * // { toAdd: [], toDelete: [], toUpdate: [{ id: 'r1', path: 'image', documentId: 'm2', … }] }
 * ```
 */
export const defineRelationsDiff = ({
  existingRelations,
  incomingRelations,
  locale
}: Args): RelationDiff => {
  const toAdd: BeforeOperationRelation[] = [];
  const toUpdate: RelationRow[] = [];

  // The rows an incoming relation names by `id` are that relation's: a bare id never takes them
  const claimed = new Set(incomingRelations.flatMap((incoming) => incoming.id ?? []));

  /**
   * The stored row an incoming relation is: the row it names by `id`, else an unclaimed row
   * holding the same document at the same path, in the same locale.
   */
  const isRowOf = (existing: RelationRow, incoming: BeforeOperationRelation) =>
    incoming.id
      ? existing.id === incoming.id
      : !claimed.has(existing.id!) &&
        existing.documentId === incoming.documentId &&
        existing.path === incoming.path &&
        sameLocale(existing, incoming);

  // A stored row is the row of the first incoming relation that matches it, and of no other
  const matched = new Set<string>();

  for (const incoming of incomingRelations) {
    const existingMatch = existingRelations.find(
      (existing) => !matched.has(existing.id!) && isRowOf(existing, incoming)
    );
    if (!existingMatch) {
      toAdd.push(incoming);
      continue;
    }
    matched.add(existingMatch.id!);
    if (needUpdate(existingMatch, incoming)) {
      toUpdate.push({
        ...existingMatch,
        path: incoming.path,
        position: incoming.position,
        relationTo: incoming.relationTo,
        documentId: incoming.documentId,
        locale: incoming.locale ?? null
      });
    }
  }

  // Rows of another locale are that locale's
  const toDelete = existingRelations.filter(
    (existing) => !(existing.locale && existing.locale !== locale) && !matched.has(existing.id!)
  );

  return { toAdd, toDelete, toUpdate };
};
