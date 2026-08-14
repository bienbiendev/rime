import { isFormField } from '$lib/core/fields/util.js';
import type { TreeBlock } from '$lib/core/types/doc.js';
import type { TreeBuilder } from '$lib/fields/tree/index.js';
import type { ConfigMap } from './types.js';

export function buildTreeFieldsMap(
  treeConfig: TreeBuilder,
  treeItems: TreeBlock[],
  basePath: string
): ConfigMap {
  const treeMap: ConfigMap = {};

  // Helper to add field configs for a specific path
  const addFieldConfigs = (path: string) => {
    for (const field of treeConfig.__fields) {
      if (isFormField(field)) {
        treeMap[`${path}.${field.name}`] = field;
      }
    }
  };

  // Process each item in the tree
  const processItem = (item: TreeBlock, itemPath: string) => {
    // Add configs for current item
    addFieldConfigs(itemPath);

    // If item has children, process them
    if (item._children && Array.isArray(item._children)) {
      item._children.forEach((child: TreeBlock, childIndex: number) => {
        const childPath = `${itemPath}._children.${childIndex}`;
        processItem(child, childPath);
      });
    }
  };

  // Process each root level item
  treeItems.forEach((item, index) => {
    const itemPath = `${basePath}.${index}`;
    processItem(item, itemPath);
  });

  return treeMap;
}
