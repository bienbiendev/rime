import type { BeforeOperationRelation } from '$lib/adapter-sqlite/relations.js';
import { isRelationField } from '$lib/fields/relation/index.js';
import { getValueAtPath } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { ConfigMap } from '../configMap/types.js';

type Args = {
  ownerId?: string;
  data: Dic;
  configMap: ConfigMap;
  locale: string | undefined;
};

export const extractRelations = ({ ownerId, data, configMap, locale }: Args) => {
  const relations: BeforeOperationRelation[] = [];

  for (const [path, config] of Object.entries(configMap)) {
    if (isRelationField(config)) {
      const value = getValueAtPath<BeforeOperationRelation[] | string | string[]>(path, data);

      const localized = config.localized;
      const relationRawValue = value;
      let output: BeforeOperationRelation[] = [];

      const relationFromString = ({ value, position = 0 }: RelationFromStringArgs) => {
        const result: BeforeOperationRelation = {
          position,
          relationTo: config.relationTo,
          documentId: value,
          ownerId,
          path
        };
        if (localized) {
          result.locale = locale;
        }
        return result;
      };

      const completeRelation = ({ value, position = 0 }: AugmentRelationArgs) => {
        const result: BeforeOperationRelation = {
          id: value.id || undefined,
          position,
          relationTo: config.relationTo,
          documentId: value.documentId,
          ownerId,
          path
        };
        if (localized) {
          result.locale = locale;
        }
        return result;
      };

      // If value is array
      if (Array.isArray(relationRawValue)) {
        output = relationRawValue.map((value, n) => {
          // Array of string build the relation value
          if (typeof value === 'string') {
            return relationFromString({ value, position: n });
          } else {
            // Complete possible missing props
            return completeRelation({ value, position: n });
          }
        });
        // Check if it's a string
      } else if (typeof relationRawValue === 'string') {
        output = [relationFromString({ value: relationRawValue, position: 0 })];
      }
      relations.push(...output);
    }
  }

  return relations;
};

type RelationFromStringArgs = {
  value: string;
  position?: number;
};

type AugmentRelationArgs = {
  value: Partial<BeforeOperationRelation> & { documentId: string };
  position?: number;
};
