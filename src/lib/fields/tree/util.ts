/**
 * The tree field's name and the path inside it.
 *
 * ```ts
 * extractFieldName('nav.0._children'); // ['nav', '0._children']
 * extractFieldName('group.nav'); // ['nav', '']
 * extractFieldName('nav.0'); // ['', '']
 * ```
 */
export const extractFieldName = (path: string): [string, string] => {
  // Single segment
  if (!path.includes('.')) {
    return [path, ''];
  }

  // Segment followed by .number._children
  const regexPattern = /([^.]+)\.((?:\d+\._children(?:\.\d+\._children)*)$)/;
  const match = path.match(regexPattern);
  if (match) {
    return [match[1], match[2]];
  }

  // Last segment (not number or _children)
  const segments = path.split('.');
  const lastSegment = segments[segments.length - 1];
  if (isNaN(Number(lastSegment)) && lastSegment !== '_children') {
    return [lastSegment, ''];
  }

  return ['', ''];
};

type Nested = { _children?: Nested[] };

/**
 * How many levels sit under a tree item: 0 for an item with no children.
 *
 * ```ts
 * levelsBelow({ _children: [] }); // 0
 * levelsBelow({ _children: [{ _children: [] }] }); // 1
 * levelsBelow({ _children: [{ _children: [{ _children: [] }] }] }); // 2
 * ```
 */
export const levelsBelow = (item: Nested): number =>
  Math.max(0, ...(item._children ?? []).map((child) => 1 + levelsBelow(child)));
