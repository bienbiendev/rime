import { describe, expect, it } from 'vitest';
import { RichTextFieldBuilder } from './index.js';
import { referenceNodes, referenceOf, storedReferences } from './reference-nodes.js';

const media = {
  id: 'm1',
  legend: 'Sea',
  url: '/uploads/medias/sea.jpg',
  sizes: { thumbnail: '/uploads/medias/sea-thumbnail-400.jpg' },
  title: 'sea.jpg',
  mimeType: 'image/jpeg',
  filename: 'sea.jpg',
  _fresh: false
};
const page = {
  id: 'p1',
  title: 'About',
  _type: 'pages',
  _thumbnail: '/medias/about.jpg',
  _fresh: false
};

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    { type: 'rich-text-upload-medias', attrs: media },
    {
      type: 'blockquote',
      content: [
        { type: 'rich-text-upload-docs', attrs: { ...media, id: 'd1', legend: undefined } },
        { type: 'rich-text-resource-pages', attrs: page }
      ]
    }
  ]
};

describe('referenceOf and referenceNodes', () => {
  it('name the kind and collection of each node naming a document, at any depth', () => {
    expect(referenceNodes(doc).map(({ kind, slug }) => `${kind}:${slug}`)).toEqual([
      'upload:medias',
      'upload:docs',
      'resource:pages'
    ]);
    expect(referenceOf({ type: 'paragraph' })).toBeUndefined();
  });
});

describe('storedReferences', () => {
  it('keeps what each kind stores, at any depth', () => {
    const stored = storedReferences(doc);
    expect(stored.content![0]).toEqual(doc.content[0]);
    expect(stored.content![1].attrs).toEqual({ id: 'm1', legend: 'Sea' });
    expect(stored.content![2].content![0].attrs).toEqual({ id: 'd1', legend: null });
    expect(stored.content![2].content![1].attrs).toEqual({ id: 'p1' });
  });

  it('keeps a node with no id as it is', () => {
    const legacy = { type: 'rich-text-resource-pages', attrs: { title: 'Old', _type: 'pages' } };
    expect(storedReferences({ type: 'doc', content: [legacy] }).content![0]).toEqual(legacy);
  });

  it('is the save of a rich-text field, and leaves a plain string', () => {
    expect(RichTextFieldBuilder.storeReferences(doc)).toEqual(storedReferences(doc));
    expect(RichTextFieldBuilder.storeReferences('Hello')).toBe('Hello');
  });
});
