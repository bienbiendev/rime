import { Node, type JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { richText, RichTextFieldBuilder } from './index.js';
import { RichText } from './json.js';

const value = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
};

describe('RichTextFieldBuilder.jsonParse', () => {
  it('parses a stored JSON string', () => {
    expect(RichTextFieldBuilder.jsonParse(JSON.stringify(value))).toEqual(value);
  });

  it('gives a document back as it is', () => {
    expect(RichTextFieldBuilder.jsonParse(value)).toBe(value);
  });

  it('reads a text node stored as a number as a string, and leaves other text keys alone', () => {
    const stored = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 2024 }] },
        { type: 'rich-text-fields-cta', attrs: { json: { text: null, label: 3 } } }
      ]
    });
    const parsed = RichTextFieldBuilder.jsonParse(stored) as JSONContent;
    expect(parsed.content?.[0].content?.[0].text).toBe('2024');
    expect(parsed.content?.[1].attrs?.json).toEqual({ text: null, label: 3 });
  });

  it('keeps a plain string, digits included', () => {
    expect(RichTextFieldBuilder.jsonParse('Title (copy)')).toBe('Title (copy)');
    expect(RichTextFieldBuilder.jsonParse('2024')).toBe('2024');
  });
});

describe('RichTextFieldBuilder.sanitize', () => {
  const linked = (href: string) => ({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'go', marks: [{ type: 'link', attrs: { href } }] }]
      }
    ]
  });

  it('removes a script href from a document sent as a JSON string', () => {
    const sent = JSON.stringify(linked('javascript:x'));
    const sanitized = RichTextFieldBuilder.sanitize(sent) as JSONContent;
    expect(sanitized.content?.[0].content?.[0].marks?.[0].attrs).toEqual({});
  });

  it('keeps a plain string', () => {
    expect(RichTextFieldBuilder.sanitize('Title (copy)')).toBe('Title (copy)');
  });
});

describe('RichText.toText', () => {
  it('gives a plain string back as it is', () => {
    expect(RichText.toText('Title (copy)')).toBe('Title (copy)');
  });

  it('reads the text of a document', () => {
    expect(RichText.toText(value)).toBe('Hello');
  });
});

describe('RichText.appendText', () => {
  it('adds the text after the last text node, which keeps its node and marks', () => {
    const heading = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Sale', marks: [{ type: 'bold' }] }]
        }
      ]
    };
    expect(RichText.appendText(heading, ' (copy)')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            { type: 'text', text: 'Sale', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' (copy)' }
          ]
        }
      ]
    });
  });

  it('adds the text after the last text node, whatever follows it', () => {
    const sale = { type: 'text', text: 'Sale' };
    const copy = { type: 'text', text: ' (copy)' };
    const heading = { type: 'heading', attrs: { level: 1 }, content: [sale] };
    const withCopy = { ...heading, content: [sale, copy] };
    const doc = (...content: JSONContent[]) => ({ type: 'doc', content });

    expect(RichText.appendText(doc(heading, { type: 'paragraph' }), ' (copy)')).toEqual(
      doc(withCopy, { type: 'paragraph' })
    );
    expect(RichText.appendText(doc(heading, { type: 'horizontalRule' }), ' (copy)')).toEqual(
      doc(withCopy, { type: 'horizontalRule' })
    );
    const broken = { type: 'paragraph', content: [sale, { type: 'hardBreak' }] };
    expect(RichText.appendText(doc(broken), ' (copy)')).toEqual(
      doc({ type: 'paragraph', content: [sale, copy, { type: 'hardBreak' }] })
    );
  });

  it('adds a paragraph to a document with no text node', () => {
    expect(RichText.appendText({ type: 'doc', content: [] }, ' (copy)')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: ' (copy)' }] }]
    });
  });
});

describe('richText().features', () => {
  const nodeFeature = (name: string) => ({ extension: Node.create({ name }) });

  it('refuses two features that make the same node type', () => {
    const twice = () =>
      richText('body').features(
        nodeFeature('rich-text-upload-medias'),
        nodeFeature('rich-text-upload-medias')
      );
    expect(twice).toThrow('rich-text-upload-medias');
    expect(() =>
      richText('body').features(nodeFeature('rich-text-upload-medias'), nodeFeature('paragraph'))
    ).not.toThrow();
  });
});
