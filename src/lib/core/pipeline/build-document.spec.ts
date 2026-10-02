import { expect, test } from 'vitest';
import { buildDocument } from './build-document.server.js';

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
