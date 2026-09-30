import { blocks, block, group, relation, tab, tabs, text, tree } from '$lib/fields/index.js';
import { expect, test } from 'vitest';
import { withEmptyFields } from './empty.js';

const fields = [
  text('title').defaultValue('Untitled'),
  relation('image').to('medias').defaultValue('media-1'),
  blocks('sections', [block('paragraph').fields(text('text'))]).defaultValue([
    { type: 'paragraph' }
  ]),
  group('seo').fields(text('metaTitle').defaultValue('Meta')),
  tabs(tab('nav').fields(tree('menu').fields(text('label'))))
];

test('a field the document lacks is added empty, never as its default', () => {
  expect(withEmptyFields({ id: '1' }, fields)).toEqual({
    id: '1',
    title: null,
    image: [],
    sections: [],
    seo: { metaTitle: null },
    nav: { menu: [] }
  });
});

test('what the document holds is kept, empty values included', () => {
  const doc = {
    id: '1',
    title: null,
    image: [{ relationTo: 'medias', documentId: 'm' }],
    sections: [{ id: 'b', type: 'paragraph', text: 'x' }],
    seo: { metaTitle: 'Kept' },
    nav: { menu: [] }
  };

  expect(withEmptyFields(doc, fields)).toEqual(doc);
});
