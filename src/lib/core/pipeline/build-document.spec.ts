import {
  block as blockType,
  blocks,
  relation as relationField,
  text,
  tree
} from '#lib/fields/index.js';
import { expect, test } from 'vitest';
import { buildDocument } from './build-document.server.js';
import { populatedKey } from './populate-relations.server.js';

const config = { slug: 'pages' } as any;

const block = (position: number) => ({
  id: `b${position}`,
  type: 'card',
  path: 'sections',
  position
});

const relation = (path: string, documentId: string) => ({
  id: `r-${documentId}`,
  relationTo: 'medias',
  documentId,
  path,
  position: 0
});

const build = (blocks: ReturnType<typeof block>[], relations: ReturnType<typeof relation>[]) =>
  buildDocument({ base: { id: 'p1' }, blocks, tree: [], relations } as any, {
    config,
    allFields: false
  });

test('a relation in a block that exists is placed in it', async () => {
  const doc = await build([block(0)], [relation('sections.0.image', 'm1')]);
  expect(doc.sections).toEqual([
    { id: 'b0', type: 'card', image: [{ id: 'r-m1', relationTo: 'medias', documentId: 'm1' }] }
  ]);
});

test('a relation whose block is gone makes up no block', async () => {
  const doc = await build([block(0)], [relation('sections.1.image', 'm1')]);
  expect(doc.sections).toEqual([{ id: 'b0', type: 'card' }]);
});

test('nor through a group inside the block', async () => {
  const doc = await build([block(0)], [relation('sections.1.media.image', 'm1')]);
  expect(doc.sections).toEqual([{ id: 'b0', type: 'card' }]);
});

test('a relation outside any block is placed as is', async () => {
  const doc = await build([], [relation('hero.thumbnail', 'm1')]);
  expect(doc.hero.thumbnail).toEqual([{ id: 'r-m1', relationTo: 'medias', documentId: 'm1' }]);
});

test('a relation whose target was not read is left out, the others are copies', async () => {
  const target = { id: 'a', title: 'A' };
  const populated = new Map([[populatedKey('pages', undefined, 'a'), target as any]]);

  const doc = await buildDocument(
    {
      base: { id: 'p1' },
      blocks: [],
      tree: [],
      relations: [
        { id: 'r1', relationTo: 'pages', documentId: 'a', path: 'related', position: 0 },
        { id: 'r2', relationTo: 'pages', documentId: 'missing', path: 'related', position: 1 },
        { id: 'r3', relationTo: 'pages', documentId: 'a', path: 'again', position: 0 }
      ]
    } as any,
    { config, depth: 1, populated, allFields: false }
  );

  expect(doc.related).toEqual([target]);
  expect(doc.related[0]).not.toBe(target);
  expect(doc.again[0]).not.toBe(doc.related[0]);
});

test('a block row and a tree item read with every field of their own, and no bookkeeping', async () => {
  const fields = [
    blocks('sections', [
      blockType('hero').fields(text('title'), (relationField('image') as any).to('medias'))
    ]),
    tree('menu').fields(text('label'), (relationField('page') as any).to('pages'))
  ];
  const doc = await buildDocument(
    {
      base: { id: 'p1' },
      blocks: [{ id: 'b0', type: 'hero', path: 'sections', position: 0, ownerId: 'p1' }],
      tree: [{ id: 't0', label: 'Top', path: 'menu', position: 0, ownerId: 'p1' }],
      relations: []
    } as any,
    { config: { slug: 'pages', fields } as any }
  );

  expect(doc.sections).toEqual([{ id: 'b0', type: 'hero', title: null, image: [] }]);
  expect(doc.menu).toEqual([{ id: 't0', label: 'Top', page: [], _children: [] }]);
});
