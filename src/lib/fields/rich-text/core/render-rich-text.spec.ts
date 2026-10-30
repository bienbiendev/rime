import type { JSONContent } from '@tiptap/core';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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
