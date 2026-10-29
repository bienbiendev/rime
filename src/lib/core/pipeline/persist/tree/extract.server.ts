import type { TreeBlock } from '#lib/core/prototype/types.js';
import { getValueAtPath } from '#lib/util/object.js';
import type { Dic, WithRequired } from '#lib/util/types.js';
import cloneDeep from 'clone-deep';
import type { ConfigMap } from '../../config-map/types.js';

type ExtractTreesArgs = {
  data: Dic;
  configMap: ConfigMap;
};

/**
 * Every item of every tree field in the map, as one flat list: each item a row of its own, its
 * `path` the list it sits in (`nav`, `nav.0._children`) and `position` its index there,
 * `_children` emptied.
 */
export function extractTreeBlocks({ data, configMap }: ExtractTreesArgs) {
  const blocks: WithRequired<TreeBlock, 'path'>[] = [];

  function processTreeItem(
    item: TreeBlock,
    index: number,
    rootPath: string,
    parentPath?: string
  ): void {
    const processedItem: TreeBlock = cloneDeep({ ...item });
    processedItem.position = index;
    processedItem.path = parentPath ? `${parentPath}` : rootPath;
    processedItem._children = [];
    blocks.push(processedItem as WithRequired<TreeBlock, 'path'>);
    (item._children || []).forEach((child, childIndex) => {
      processTreeItem(
        child,
        childIndex,
        rootPath,
        `${processedItem.path}.${processedItem.position}._children`
      );
    });
  }

  Object.entries(configMap).forEach(([path, config]) => {
    if (config.type === 'tree') {
      const value = getValueAtPath<TreeBlock[]>(path, data);
      const isEmptyValue = config.use.isEmpty(value);

      if (value && !isEmptyValue) {
        value.forEach((item: TreeBlock, index: number) => {
          processTreeItem(item, index, path, undefined);
        });
      }
    }
  });

  return blocks;
}
