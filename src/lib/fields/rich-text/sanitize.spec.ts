import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { sanitizeJSONContent } from './sanitize.js';

const link = (href: string): JSONContent => ({
  type: 'text',
  text: 'go',
  marks: [{ type: 'link', attrs: { href, target: '_blank' } }]
});

describe('sanitizeJSONContent', () => {
  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:x',
    'java\tscript:x',
    'data:text/html,x'
  ])('removes the href %j', (href) => {
    expect(sanitizeJSONContent(link(href)).marks?.[0].attrs).toEqual({ target: '_blank' });
  });

  it('keeps a safe href', () => {
    expect(sanitizeJSONContent(link('https://rime.dev')).marks?.[0].attrs?.href).toBe(
      'https://rime.dev'
    );
  });

  it('cleans links deep in the tree', () => {
    const doc = sanitizeJSONContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [link('javascript:x')] }]
    });
    expect(doc.content?.[0].content?.[0].marks?.[0].attrs).toEqual({ target: '_blank' });
  });

  it('removes a script href from a node’s own attrs, vbscript included', () => {
    const node = { type: 'custom', attrs: { href: 'vbscript:x', title: 't' } };
    expect(sanitizeJSONContent(node).attrs).toEqual({ title: 't' });
  });

  it('leaves a non-string href to the renderer', () => {
    expect(sanitizeJSONContent({ type: 'custom', attrs: { href: 5 } }).attrs).toEqual({ href: 5 });
  });

  it('keeps text as typed', () => {
    for (const text of ['a < b and c > d', 'Use the <div> tag', 'I <3 rime']) {
      expect(sanitizeJSONContent({ type: 'text', text }).text).toBe(text);
    }
  });

  it('leaves a mark without attrs as it is', () => {
    const bold = { type: 'text', text: 'b', marks: [{ type: 'bold' }] };
    expect(sanitizeJSONContent(bold)).toEqual(bold);
  });
});
