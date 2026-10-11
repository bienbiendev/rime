import type { GenericBlock } from '#lib/core/prototype/types.js';
import type { BlocksField } from '#lib/fields/blocks/index.js';
import { normalizeFieldPath } from '#lib/util/string.js';
import { getValueAtPath } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import type { ConfigMap } from '../../config-map/types.js';

type ExtractBlocksArgs = {
  data: Dic;
  configMap: ConfigMap;
};

export function extractBlocks({ data, configMap }: ExtractBlocksArgs) {
  const blocks: GenericBlock[] = [];

  Object.entries(configMap).forEach(([path, config]) => {
    if (config.type === 'blocks') {
      const value = getValueAtPath<GenericBlock[]>(path, data);

      const isEmptyValue = config.use.isEmpty(value);

      if (value && !isEmptyValue) {
        const declared = new Set((config.get as BlocksField).blocks.map((block) => block.name));
        value.forEach((block: Partial<GenericBlock>, index: number) => {
          // A block of a type this list does not declare has no table to go to
          if (block.type && declared.has(block.type)) {
            // Where the block sits in the data is its place: a `path` or `position` it carries
            // from an earlier read is stale once the list is reordered
            const cleanBlock = {
              ...block,
              path: normalizeFieldPath(path),
              position: index
            };

            // Remove children blocks
            const finalBlock = Object.entries(cleanBlock).reduce((acc, [key, value]) => {
              const nestedPath = `${path}.${index}.${key}`;
              if (configMap[nestedPath]?.type === 'blocks') {
                return acc;
              }
              return { ...acc, [key]: value };
            }, {} as GenericBlock);

            blocks.push(finalBlock);
          }
        });
      }
    }
  });

  return blocks;
}
