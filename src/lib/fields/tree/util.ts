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
