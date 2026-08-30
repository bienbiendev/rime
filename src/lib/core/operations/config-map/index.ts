import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { isFormField } from '$lib/core/fields/util.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import type { Field } from '$lib/fields/types.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import { buildTreeFieldsMap } from './build-tree-map.js';
import type { ConfigMap } from './types.js';

export const buildConfigMap = (
  data: DeepPartial<GenericDoc>,
  incomingFields: FieldBuilder<Field>[]
) => {
  let map: ConfigMap = {};

  const traverseData = (data: Dic | undefined, fields: FieldBuilder<Field>[], basePath: string) => {
    if (!data) return;

    basePath = basePath === '' ? basePath : `${basePath}.`;

    for (const field of fields) {
      if (field instanceof TabsBuilder) {
        for (const tab of field.get.tabs) {
          if (tab.name in data) {
            traverseData(data[tab.name], tab.get.fields, tab.name);
          }
        }
        continue;
      }

      if (!isFormField(field)) continue;
      if (!(field.name in data)) continue;

      const value = data[field.name];
      const path = `${basePath}${field.name}`;

      map[path] = field;

      if (field instanceof BlocksBuilder && value && Array.isArray(value)) {
        const blocks = value;
        for (const [index, block] of blocks.entries()) {
          try {
            const blockConfig = field.get.blocks.find((b) => b.name === block.type);
            if (blockConfig) {
              traverseData(block, blockConfig.get.fields, `${path}.${index}`);
            }
          } catch {
            console.warn(
              `block at path ${path} and postition ${index} not found but there are some residual data owned by this block`
            );
          }
        }
      } else if (field instanceof TreeBuilder && value && Array.isArray(value)) {
        const treeMap = buildTreeFieldsMap(field, value, path);
        map = { ...map, ...treeMap };
      } else if (field instanceof GroupFieldBuilder) {
        traverseData(value, field.get.fields, path);
      }
    }
  };

  traverseData(data, incomingFields, '');
  return map;
};
