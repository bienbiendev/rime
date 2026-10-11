import type { Adapter } from '#lib/core/adapter.js';
import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import { Relation } from './relation.js';

/**
 * The ids a relation value names: bare ids, refs, and documents read at depth 1 and sent back.
 * One value outside an array is a list of one. A `null` element names nothing.
 */
export const relationIds = (value: unknown): string[] => {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => {
    const id =
      typeof entry === 'string'
        ? entry
        : Relation.isRef(entry)
          ? entry.documentId
          : (entry as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id ? [id] : [];
  });
};

/**
 * The ids in a relation value that name no document, asked of the database in one query. Run
 * before anything is written: a stale id fails the save, it is never dropped from it.
 */
export const missingRelations = (adapter: Adapter, relationTo: PrototypeSlug, value: unknown) => {
  const ids = relationIds(value);
  return ids.length ? adapter.relations.missing({ relationTo, ids }) : Promise.resolve([]);
};
