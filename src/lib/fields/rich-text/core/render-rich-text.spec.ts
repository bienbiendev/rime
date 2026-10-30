import type { JSONContent } from '@tiptap/core';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import Keys from './render-rich-text.spec.svelte';
import RenderRichText from './render-rich-text.svelte';

const env = vi.hoisted(() => ({ dev: false }));
vi.mock('$app/env', () => env);

/** The server-rendered HTML of a document, without Svelte's hydration markers. */
const html = (content: JSONContent[], components?: Record<string, any>) =>
  render(RenderRichText, { props: { json: { type: 'doc', content }, components } }).body.replace(
    /<!--.*?-->/g,
    ''
  );

describe('a node without its component', () => {
  const nodes: JSONContent[] = [
    {
      type: 'rich-text-upload-medias',
      attrs: { url: '/medias/a.pdf', mimeType: 'application/pdf' }
    },
    { type: 'rich-text-resource-pages', attrs: { _type: 'pages', title: 'About' } },
    { type: 'rich-text-fields-cta', attrs: {} }
  ];

  beforeEach(() => {
    env.dev = false;
  });

  test('renders nothing on a built site', () => {
    expect(html(nodes)).toBe('');
  });

  test('renders a hint in development', () => {
    env.dev = true;
    expect(html(nodes)).toBe(
      '[Provide a media component to render this node]' +
        '[Provide a resource component to render this node]' +
        '[Provide a fields component to render this node]'
    );
  });
});

test('a custom node gets `components`, as a custom mark does', () => {
  const components = { callout: Keys, highlight: Keys };
  const callout = { type: 'callout', content: [{ type: 'text', text: 'Hi' }] };
  const highlighted = { type: 'text', text: 'Hi', marks: [{ type: 'highlight' }] };
  expect(html([callout, highlighted], components)).toBe(
    '<aside>callout,highlight</aside><aside>callout,highlight</aside>'
  );
});

test('a default element writes only the attributes it knows', () => {
  const style = { style: 'position:fixed', class: 'x', id: 'y' };
  const text = (marks: JSONContent['marks']) => [{ type: 'text', text: 'Hi', marks }];
  const link = { type: 'link', attrs: { ...style, href: '/a', target: '_blank', rel: 'noopener' } };
  expect(
    html([
      { type: 'paragraph', attrs: style, content: text([{ type: 'bold', attrs: style }]) },
      { type: 'heading', attrs: { ...style, level: 3 }, content: text([link]) },
      { type: 'blockquote', attrs: style, content: text([{ type: 'italic', attrs: style }]) },
      {
        type: 'orderedList',
        attrs: { ...style, start: 3 },
        content: [{ type: 'listItem', attrs: style, content: text([]) }]
      },
      { type: 'bulletList', attrs: style, content: [] }
    ])
  ).toBe(
    '<p><strong>Hi</strong></p>' +
      '<h3><a href="/a" target="_blank" rel="noopener">Hi</a></h3>' +
      '<blockquote><em>Hi</em></blockquote>' +
      '<ol start="3"><li>Hi</li></ol>' +
      '<ul></ul>'
  );
});

test('a heading level outside 1 to 6 renders an h2', () => {
  const heading = (level: unknown) => ({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text: 'Hi' }]
  });
  expect(html([heading('1 x'), heading(7), heading(null), heading('4')])).toBe(
    '<h2>Hi</h2><h2>Hi</h2><h2>Hi</h2><h4>Hi</h4>'
  );
});
