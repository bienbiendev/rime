import { getSchema, type JSONContent } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { editorContent } from './content.js';

const schema = getSchema([Document, Paragraph, Text, Bold]);
const text = (value: string, marks?: { type: string }[]): JSONContent => ({
  type: 'text',
  text: value,
  ...(marks && { marks })
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

describe('editorContent', () => {
  it('opens a plain string as one paragraph', () => {
    expect(editorContent('Title (copy)', schema)).toEqual({
      doc: doc({ type: 'paragraph', content: [text('Title (copy)')] }),
      unsupported: []
    });
    expect(editorContent('', schema)).toEqual({ doc: undefined, unsupported: [] });
  });

  it('names unknown marks and nodes, keeps their text, and leaves the value untouched', () => {
    const value = doc({ type: 'callout', content: [text('Hi', [{ type: 'strike' }])] });
    const opened = editorContent(value, schema);
    expect(opened.unsupported.sort()).toEqual(['callout', 'strike']);
    expect(opened.doc?.content?.[0]).toMatchObject({
      type: 'paragraph',
      content: [{ text: 'Hi' }]
    });
    expect(value.content?.[0]).toMatchObject({ type: 'callout' });
  });

  it('names an unknown node with no content and leaves it out', () => {
    const opened = editorContent(doc({ type: 'chart' }, { type: 'paragraph' }), schema);
    expect(opened.unsupported).toEqual(['chart']);
    expect(opened.doc?.content?.map((node) => node.type)).toEqual(['paragraph']);
  });

  it('opens a value the schema holds unchanged', () => {
    const value = doc({ type: 'paragraph', content: [text('Hi', [{ type: 'bold' }])] });
    expect(editorContent(value, schema)).toEqual({ doc: value, unsupported: [] });
  });

  it('opens nothing for an empty value', () => {
    expect(editorContent(null, schema)).toEqual({ doc: undefined, unsupported: [] });
  });
});
