/**
 * Moves an item from one position to another within an array.
 * Creates a new array instead of modifying the original.
 *
 * @example
 * // Move the second item to the fourth position
 * const newArray = moveItem(['a', 'b', 'c', 'd', 'e'], 1, 3);
 * // Result: ['a', 'c', 'd', 'b', 'e']
 */
export const moveItem = <T>(arr: T[], fromIndex: number, toIndex: number): T[] => {
  const copy = [...arr];
  const element = copy[fromIndex];
  copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, element);
  return copy;
};
