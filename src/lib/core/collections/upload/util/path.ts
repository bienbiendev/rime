import { PARAMS, UPLOAD_PATH } from '$lib/core/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import type { Route } from '$lib/panel/types.js';
import { panelUrl } from '$lib/panel/util/url.js';
import { toKebabCase } from '$lib/util/string.js';
import type { WithRequired } from '$lib/util/types.js';

export type UploadPath = `${typeof UPLOAD_PATH.ROOT_NAME}${string}`;
type Aria = WithRequired<Partial<Route>, 'title'>;

/**
 * Validates that a path string follows the required format:
 * - Must start with ROOT_NAME
 * - Only allows alphanumeric characters, hyphens, underscores, spaces, and the separator
 * - Can only use the defined separator
 * @example
 * validatePath("root:folder:subfolder") // valid
 * validatePath("root:folder with spaces:sub-folder_name") // valid
 * validatePath("root/folder") // throws Error
 * validatePath("root:folder$") // throws Error
 */

/**
 * Given an optional path string
 * this returns:
 * - the name (last part of the segment)
 * - the parent path (path without the name)
 * - the normalized path
 * @example
 * getSegments("root:foo:bar") // { name: "bar", parent: "root:foo", path: "root:foo:bar" }
 * getSegments("root") // { name: "root", parent: null, path: "root" }
 */
export function getSegments(path?: UploadPath | null): {
  name: string;
  path: UploadPath;
  parent: UploadPath | null;
} {
  // Use nullish coalescing to handle both undefined and null
  const safePath = path ?? UPLOAD_PATH.ROOT_NAME;

  // Validate and normalize the path
  const isValid = validatePath(safePath);
  if (typeof isValid === 'string') {
    throw new RimeError(RimeError.BAD_REQUEST, isValid);
  }

  const segments = safePath
    .split(UPLOAD_PATH.SEPARATOR)
    .filter((s) => s !== UPLOAD_PATH.SEPARATOR)
    .filter((s) => !!s);

  if (segments.length <= 1) {
    return {
      name: UPLOAD_PATH.ROOT_NAME,
      path: UPLOAD_PATH.ROOT_NAME,
      parent: null
    };
  }

  const name = segments[segments.length - 1];
  // Only create parent if we have more than one segment
  const parent = segments.length > 1 ? segments.slice(0, -1).join(UPLOAD_PATH.SEPARATOR) : null;
  // Reconstruct the normalized path from filtered segments
  const normalizedPath = segments.join(UPLOAD_PATH.SEPARATOR) as UploadPath;

  return {
    name,
    parent: parent as UploadPath,
    path: normalizedPath
  };
}

/**
 * Get the parent path for a given path
 * or return null if path is ROOT_NAME
 * @example
 * // returns 'root'
 * getParentPath('root:foo')
 */
export function getParentPath(path: UploadPath) {
  if (path === UPLOAD_PATH.ROOT_NAME) return null;
  return path.split(UPLOAD_PATH.SEPARATOR).slice(0, -1).join(UPLOAD_PATH.SEPARATOR);
}

/**
 * Build an array of route based on the path param
 * for a given collection slug.
 * This omiting the root path wich is the collection path and do not add the path to the last
 * @example
 * buildUploadAria('root:foo')
 * // return [{ title: 'foo' }]
 * buildUploadAria('root:foo:bar')
 * // return [{ title: 'foo', path: '/panel/{slug}?=root:foo' }, { title: 'bar' }]
 */
export function buildUploadAria({
  path,
  slug
}: {
  path: UploadPath;
  slug: CollectionSlug;
}): Partial<Route>[] {
  const segments = path.split(':');
  const result: Aria[] = [];
  let currentPath = '';

  for (const segment of segments) {
    if (!segment) continue;
    currentPath = currentPath ? `${currentPath}:${segment}` : segment;
    if (currentPath !== segments[0]) {
      result.push({
        title: segment,
        url: `${panelUrl(toKebabCase(slug))}?${PARAMS.UPLOAD_PATH}=${currentPath}`
      });
    }
  }

  return result;
}

export function removePathFromLastAria(aria: Partial<Route>[]) {
  return aria.map((route, index) => {
    if (index === aria.length - 1) {
      return { title: route.title };
    }
    return route;
  });
}

/**
 * Validates that a path string follows the required format:
 * - Must start with ROOT_NAME
 * - Only allows alphanumeric characters, hyphens, underscores, spaces, and the separator
 * - Can only use the defined separator
 * @example
 * validatePath("root:folder:subfolder") // valid
 * validatePath("root:folder with spaces:sub-folder_name") // valid
 * validatePath("root/folder") // invalid
 * validatePath("root:folder$") // invalid
 */
export const validatePath = (value: unknown): string | true => {
  if (typeof value !== 'string') {
    return 'path should be a string';
  }

  // Check if path starts with ROOT_NAME
  const STARTS_WITH_ROOT =
    value === UPLOAD_PATH.ROOT_NAME || value.startsWith(`${UPLOAD_PATH.ROOT_NAME}:`);
  if (!STARTS_WITH_ROOT) {
    return `Path must start with "${UPLOAD_PATH.ROOT_NAME}"`;
  }

  // Create a mutable copy for normalization
  let normalizedPath = value;

  // Remove trailing separator if present
  while (
    normalizedPath !== UPLOAD_PATH.ROOT_NAME &&
    normalizedPath.endsWith(UPLOAD_PATH.SEPARATOR)
  ) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  // Only allow alphanumeric characters, hyphens, underscores, spaces, and the separator
  // The regex ensures:
  // 1. Starts with ROOT_NAME
  // 2. Followed by zero or more segments (each segment starts with separator followed by valid chars)
  const validPathRegex = new RegExp(
    `^${UPLOAD_PATH.ROOT_NAME}(${UPLOAD_PATH.SEPARATOR}[a-zA-Z0-9\\-_ ]+)*$`
  );

  if (!validPathRegex.test(normalizedPath)) {
    return 'Path contains invalid characters. Only alphanumeric characters, hyphens, underscores, and spaces are allowed.';
  }

  return true;
};
