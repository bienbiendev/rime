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
 * The text of a rich text value, its nodes' text joined by spaces.
 *
 * ```ts
 * RichText.toText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
 * // 'Hello'
 * ```
 */
const toText = (value: string | JSONContent | undefined): string => {
  if (!value) return '';
  let textValue: string;
  const renderNodes = (nodes: { [k: string]: any }) => {
    return nodes
      .map((node: { text?: string; [k: string]: any }) => {
        if ('text' in node) {
          return node.text;
        } else if ('content' in node) {
          return renderNodes(node.content);
        }
      })
      .join(' ');
  };

  try {
    const jsonContent = typeof value === 'string' ? JSON.parse(value) : value;
    textValue = renderNodes(jsonContent.content);
  } catch (err) {
    console.error(err);
    textValue = JSON.stringify(value);
  }
  return textValue;
};

/** Reads rich text field values. */
export const RichText = { toText };
