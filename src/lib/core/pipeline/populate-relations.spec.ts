import { expect, test, vi } from 'vitest';
import { buildDocument } from './build-document.server.js';
import { populatedKey, populateRelations } from './populate-relations.server.js';

const rows = (relations: Record<string, unknown>[]) => ({
  base: { id: 'p' },
  blocks: [],
  tree: [],
  relations
});

/** An event whose collections answer findByIds with one doc per id, and record each call. */
const eventWith = () => {
  const calls: { slug: string; ids: string[]; locale?: string; depth: number }[] = [];
  const event = {
    locals: {
      rime: {
        collection: (slug: string) => ({
          findByIds: vi.fn(async (args: { ids: string[]; locale?: string; depth: number }) => {
            calls.push({ slug, ...args });
            return args.ids.map((id) => ({ id, slug }));
          })
        })
      }
    }
  };
  return { event: event as any, calls };
};

test('one read per collection and locale, each id once, one level down', async () => {
  const { event, calls } = eventWith();

  const populated = await populateRelations(
    [
      rows([
        { relationTo: 'pages', documentId: 'a', path: 'related' },
        { relationTo: 'pages', documentId: 'b', path: 'related' },
        { relationTo: 'medias', documentId: 'm', path: 'image' }
      ]),
      rows([
        { relationTo: 'pages', documentId: 'b', path: 'related' },
        { relationTo: 'pages', documentId: 'c', path: 'related', locale: 'fr' },
        // written in another locale, or pointing nowhere: not read
        { relationTo: 'pages', documentId: 'd', path: 'related', locale: 'en' },
        { relationTo: 'pages', documentId: null, path: 'related' }
      ])
    ] as any,
    { event, locale: 'fr', depth: 2 }
  );

  expect(calls).toEqual([
    { slug: 'pages', ids: ['a', 'b'], locale: undefined, depth: 1 },
    { slug: 'medias', ids: ['m'], locale: undefined, depth: 1 },
    { slug: 'pages', ids: ['c'], locale: 'fr', depth: 1 }
  ]);
  expect([...populated.keys()]).toEqual([
    populatedKey('pages', undefined, 'a'),
    populatedKey('pages', undefined, 'b'),
    populatedKey('medias', undefined, 'm'),
    populatedKey('pages', 'fr', 'c')
  ]);
});

test('a relation whose target was not read is left out, the others are copies', async () => {
  const target = { id: 'a', title: 'A' };
  const populated = new Map([[populatedKey('pages', undefined, 'a'), target as any]]);

  const doc = await buildDocument(
    rows([
      { id: 'r1', relationTo: 'pages', documentId: 'a', path: 'related', position: 0 },
      { id: 'r2', relationTo: 'pages', documentId: 'missing', path: 'related', position: 1 },
      { id: 'r3', relationTo: 'pages', documentId: 'a', path: 'again', position: 0 }
    ]) as any,
    {
      config: { slug: 'pages' } as any,
      event: { locals: { rime: {} }, params: {} } as any,
      depth: 1,
      populated,
      withBlank: false
    }
  );

  expect(doc.related).toEqual([target]);
  expect(doc.related[0]).not.toBe(target);
  expect(doc.again[0]).not.toBe(doc.related[0]);
});
