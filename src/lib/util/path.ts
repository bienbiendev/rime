/**
 * Field-path string helpers. No rime vocabulary and no imports at all, which is why they sit
 * in util/ while the document builders they used to share util/doc.ts with moved to
 * core/prototype/doc.ts.
 *
 * Keeping this file import-free is what removes the old util/doc <-> util/object cycle:
 * object.ts needs normalizeFieldPath, so nothing here may reach back into object.ts.
 * ensurePathExists lives there instead, for exactly that reason.
 */

/**
 * Remove block type in path
 * @example
 * normalizePath('foo.bar.0:content.baz')
 *
 * // return foo.bar.0.baz
 */
export const normalizeFieldPath = (path: string) => {
  const regExpBlockType = /:[a-zA-Z0-9]+/g;
  return path.replace(regExpBlockType, '');
};

