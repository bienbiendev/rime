import { isSafeUrl } from '#lib/util/url.js';
import type { JSONContent } from '@tiptap/core';

type Attrs = Record<string, any> | undefined;

/** Removes an `href` that would run script. */
const sanitizeAttrs = (attrs: Attrs): Attrs => {
  if (typeof attrs?.href !== 'string' || isSafeUrl(attrs.href)) return attrs;
  const rest = { ...attrs };
  delete rest.href;
  return rest;
};

/**
 * Removes the unsafe `href` of every node and mark. Text is kept as typed: the renderer escapes it.
 *
 * ```ts
 * sanitizeJSONContent({ type: 'text', text: 'a < b', marks: [{ type: 'link', attrs: { href: 'javascript:x' } }] })
 * // { type: 'text', text: 'a < b', marks: [{ type: 'link', attrs: {} }] }
 * ```
 */
export const sanitizeJSONContent = (content: JSONContent): JSONContent => {
  if (!content) return content;
  return {
    ...content,
    ...(content.attrs && { attrs: sanitizeAttrs(content.attrs) }),
    ...(content.marks && {
      marks: content.marks.map((mark) =>
        mark.attrs ? { ...mark, attrs: sanitizeAttrs(mark.attrs) } : mark
      )
    }),
    ...(Array.isArray(content.content) && { content: content.content.map(sanitizeJSONContent) })
  };
};
