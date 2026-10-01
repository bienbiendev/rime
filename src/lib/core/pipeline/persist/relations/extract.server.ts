import type { BeforeOperationRelation } from '$lib/fields/relation/index.js';
import { isRelationField } from '$lib/fields/relation/index.js';
import { Relation } from '$lib/fields/relation/relation.js';
import { getValueAtPath, isObjectLiteral } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '../../config-map/types.js';

type Args = {
  ownerId?: string;
  data: Dic;
  configMap: ConfigMap;
  locale: string | undefined;
};

export const extractRelations = ({ ownerId, data, configMap, locale }: Args) => {
  const relations: BeforeOperationRelation[] = [];

  // The config map keys every field the document holds; relations are the ones stored as junction
  // rows, and the key is the `path` those rows carry.
  for (const [path, config] of Object.entries(configMap)) {
    if (isRelationField(config)) {
      const value = getValueAtPath<unknown>(path, data);
      // One value outside an array is a list of one.
      const entries = Array.isArray(value) ? value : value ? [value] : [];

      // A bare id, a ref, or a document read at depth 1 and sent back. Anything else, a `null`
      // element included, names nothing.
      const named = entries.flatMap((entry) => {
        const documentId = documentIdOf(entry);
        return documentId ? [{ entry, documentId }] : [];
      });

      named.forEach(({ entry, documentId }, position) => {
        relations.push({
          // A ref's own row, so the stored row is updated rather than replaced.
          id: Relation.isRef(entry) ? entry.id || undefined : undefined,
          position,
          relationTo: config.get.relationTo,
          documentId,
          ownerId,
          path,
          ...(config.get.localized && { locale })
        });
      });
    }
  }

  return relations;
};

const documentIdOf = (entry: unknown): string | null => {
  if (typeof entry === 'string') return entry || null;
  if (Relation.isRef(entry)) return entry.documentId;
  if (isObjectLiteral(entry) && typeof entry.id === 'string') return entry.id;
  return null;
};
