import type { JSONContent } from '@tiptap/core';

/**
 * Type guard to check if a value is a JSONContent object.
 *
 * @example
 * isJSONContent({ type: 'paragraph', content: [] }) // true
 * isJSONContent('Just a string') // false
 */
export const isJSONContent = (value: any): value is JSONContent => {
  return typeof value === 'object' && value !== null && 'content' in value;
};

/**
 * The text of a rich text value: the text runs of a block joined as they are, the blocks joined
 * by a space.
 *
 * ```ts
 * // <p><b>Re</b>think</p><p>it</p>
 * RichText.toText(value); // 'Rethink it'
 * ```
 */
const toText = (value: string | JSONContent | undefined): string => {
  if (!value) return '';
  // A plain string, not a JSON document: it is the text
  const plain = typeof value === 'string' ? value : '';
  try {
    const jsonContent = typeof value === 'string' ? JSON.parse(value) : value;
    return isJSONContent(jsonContent) ? nodeText(jsonContent) : plain;
  } catch {
    return plain;
  }
};

/** A text node's text, a hard break as a space, or the children's text. */
const nodeText = (node: JSONContent): string => {
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'hardBreak') return ' ';
  const children = node.content ?? [];
  const isInline = children.some((child) => typeof child.text === 'string');
  return children
    .map(nodeText)
    .filter(Boolean)
    .join(isInline ? '' : ' ');
};

/**
 * The value with `text` added after its last text node, so the node holding it keeps its type
 * and marks. A value with no text node gets the text as a paragraph of its own.
 *
 * ```ts
 * RichText.appendText({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Sale' }] }] }, ' (copy)');
 * // { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Sale' }, { type: 'text', text: ' (copy)' }] }] }
 * ```
 */
const appendText = (value: JSONContent, text: string): JSONContent => {
  // The node with `text` after its last text child, or after the text of its last child that
  // holds some; null when no child holds text.
  const appendTo = (node: JSONContent): JSONContent | null => {
    const children = node.content ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i].type === 'text') {
        const added: JSONContent = { type: 'text', text };
        return { ...node, content: [...children.slice(0, i + 1), added, ...children.slice(i + 1)] };
      }
      const appended = appendTo(children[i]);
      if (appended) {
        return { ...node, content: children.map((child, j) => (j === i ? appended : child)) };
      }
    }
    return null;
  };
  return (
    appendTo(value) ?? {
      ...value,
      content: [...(value.content ?? []), { type: 'paragraph', content: [{ type: 'text', text }] }]
    }
  );
};

/** Reads rich text field values, and adds text to them. */
export const RichText = { toText, appendText };
