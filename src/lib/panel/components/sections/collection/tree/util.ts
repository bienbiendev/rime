import type { Dic } from '$lib/util/types.js';

type Row = Dic & { _children?: Row[] };

/**
 * Counts the total number of rows in a nested structure
 * @param elements Array of row elements that may contain children
 * @param skipLastChildren Whether to skip counting children of the last element
 * @returns Total number of rows
 */
export function countRows(elements: Row[], skipLastChildren: boolean = true): number {
  if (!elements || elements.length === 0) return 0;

  let totalRows = 0;

  // Process all elements
  elements.forEach((element, index) => {
    // Count this row
    totalRows++;

    // Count children (skip for last element if skipLastChildren is true)
    const isLastElement = index === elements.length - 1;
    if (element._children && element._children.length > 0 && !(isLastElement && skipLastChildren)) {
      totalRows += countRows(element._children, false);
    }
  });

  return totalRows;
}
