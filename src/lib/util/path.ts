/**
 * Field-path string helpers. No rime vocabulary and no imports at all, which is what keeps them in
 * util/ while the document builders that name rime types live in core/prototype/doc.ts.
 *
 * Import-free is a constraint, not an accident: object.ts needs `normalizeFieldPath`, so nothing
 * here may reach back into object.ts or the two close a cycle. `ensurePathExists` lives there for
 * that reason.
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

