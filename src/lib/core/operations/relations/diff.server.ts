import type { BeforeOperationRelation } from '$lib/adapter-sqlite/relations.js';
import { pathToRegex } from '$lib/core/fields/util.js';
import type { Relation } from '$lib/fields/relation/index.js';

export type RelationDiff = {
  toAdd: BeforeOperationRelation[];
  toDelete: Relation[];
  toUpdate: Relation[];
};

type Args = {
  existingRelations: Relation[];
  incomingRelations: BeforeOperationRelation[];
  locale?: string;
};

const needUpdate = (existing: Relation, incoming: BeforeOperationRelation) =>
  !(
    existing.position === incoming.position &&
    existing[`${incoming.relationTo}Id` as keyof typeof existing] === incoming.documentId &&
    existing.path === incoming.path &&
    (incoming.locale ? existing.locale === incoming.locale : existing.locale === null)
  );

export const defineRelationsDiff = ({
  existingRelations,
  incomingRelations,
  locale
}: Args): RelationDiff => {
  const toAdd: BeforeOperationRelation[] = [];
  const toDelete: Relation[] = [];
  const toUpdate: Relation[] = [];
  const processedIds = new Set<string>(); // Keep track of processed IDs

  // Process incoming relations
  for (const incoming of incomingRelations) {
    const existingMatch = existingRelations.find(
      (existing) =>
        (incoming.id && existing.id === incoming.id) ||
        (!incoming.id &&
          existing[`${incoming.relationTo}Id` as keyof typeof existing] === incoming.documentId &&
          existing.path === incoming.path &&
          (incoming.locale ? existing.locale === incoming.locale : existing.locale === null))
    );

    if (existingMatch) {
      // Only add to toUpdate if we haven't processed this ID yet and if not all props are the same
      if (!processedIds.has(existingMatch.id!) && needUpdate(existingMatch, incoming)) {
        toUpdate.push({
          ...existingMatch,
          path: incoming.path,
          position: incoming.position
        });
        processedIds.add(existingMatch.id!);
      }
    } else {
      toAdd.push(incoming);
    }
  }

  // Find relations to delete
  toDelete.push(
    ...existingRelations.filter((existing) => {
      // Keep relations from other locales
      if (existing.locale && existing.locale !== locale) {
        return false;
      }

      // Delete if not found in incoming relations
      return !incomingRelations.some(
        (incoming) =>
          (incoming.id && existing.id === incoming.id) ||
          (!incoming.id &&
            existing[`${incoming.relationTo}Id` as keyof typeof existing] === incoming.documentId &&
            pathToRegex(existing.path).test(incoming.path) &&
            (incoming.locale ? existing.locale === incoming.locale : existing.locale === null))
      );
    })
  );

  return { toAdd, toDelete, toUpdate };
};
