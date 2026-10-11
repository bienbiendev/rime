import { rewriteUnknownContent, type JSONContent } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';

/** What the editor opens, and the node and mark types of the value it had to leave out. */
export type EditorContent = { doc: JSONContent | undefined; unsupported: string[] };

const paragraphOf = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

/**
 * A rich text value as the editor opens it. A plain string is one paragraph. A node or mark type
 * the schema does not hold is named in `unsupported`: its marks come off the text, and a node
 * that holds content becomes a paragraph. The value itself is left untouched.
 *
 * ```ts
 * editorContent('Title (copy)', schema)
 * // { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Title (copy)' }] }] }, unsupported: [] }
 * editorContent({ type: 'doc', content: [{ type: 'callout', content: [...] }] }, schema)
 * // { doc: { type: 'doc', content: [{ type: 'paragraph', content: [...] }] }, unsupported: ['callout'] }
 * ```
 */
export function editorContent(
  value: JSONContent | string | null | undefined,
  schema: Schema
): EditorContent {
  if (typeof value === 'string') {
    return { doc: value ? paragraphOf(value) : undefined, unsupported: [] };
  }
  if (!value?.content) return { doc: undefined, unsupported: [] };
  // rewriteUnknownContent edits what it is given
  const copy = JSON.parse(JSON.stringify(value));
  const { json, rewrittenContent } = rewriteUnknownContent(copy, schema);
  const unsupported = [...new Set(rewrittenContent.map((entry) => entry.unsupported))];
  return { doc: json ?? undefined, unsupported };
}
