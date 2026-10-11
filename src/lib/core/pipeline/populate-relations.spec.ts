import { expect, test, vi } from 'vitest';
import { populatedKey, populateRelations } from './populate-relations.server.js';

const rows = (relations: Record<string, unknown>[]) => ({
  base: { id: 'p' },
  blocks: [],
  tree: [],
  relations
});

/**
 * An event whose collections answer findByIds with one doc per id, and record each call with
 * whether it was made as rime (`system`).
 */
const eventWith = () => {
  const calls: { slug: string; system: boolean; ids: string[]; locale?: string; depth: number }[] =
    [];
  const api = (slug: string, system: boolean) => ({
    system: (isSystem = true) => api(slug, isSystem),
    findByIds: vi.fn(async (args: { ids: string[]; locale?: string; depth: number }) => {
      calls.push({ slug, system, ...args });
      return args.ids.map((id) => ({ id, slug }));
    })
  });
  const event = { locals: { rime: { collection: (slug: string) => api(slug, false) } } };
  return { event: event as any, calls };
};

test('one read per collection and locale, each id once, one level down, in the read locale', async () => {
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

  // A relation with no locale of its own reads its target in the read's locale
  expect(calls).toEqual([
    { slug: 'pages', system: false, ids: ['a', 'b'], locale: 'fr', depth: 1 },
    { slug: 'medias', system: false, ids: ['m'], locale: 'fr', depth: 1 },
    { slug: 'pages', system: false, ids: ['c'], locale: 'fr', depth: 1 }
  ]);
  expect([...populated.keys()]).toEqual([
    populatedKey('pages', undefined, 'a'),
    populatedKey('pages', undefined, 'b'),
    populatedKey('medias', undefined, 'm'),
    populatedKey('pages', 'fr', 'c')
  ]);
});

test('a system read reads its targets as rime, a caller read as the caller', async () => {
  const relations = [{ relationTo: 'pages', documentId: 'a', path: 'related' }];

  const asRime = eventWith();
  await populateRelations([rows(relations)] as any, {
    event: asRime.event,
    depth: 1,
    isSystemOperation: true
  });
  expect(asRime.calls.map((call) => call.system)).toEqual([true]);

  const asCaller = eventWith();
  await populateRelations([rows(relations)] as any, { event: asCaller.event, depth: 1 });
  expect(asCaller.calls.map((call) => call.system)).toEqual([false]);
});

test('the related documents are read with the fallback the read asked for', async () => {
  const { event, calls } = eventWith();
  const relations = [{ relationTo: 'pages', documentId: 'a', path: 'related' }];

  await populateRelations([rows(relations)] as any, {
    event,
    locale: 'fr',
    localeFallback: false,
    depth: 1
  });

  expect(calls.map((call: any) => call.localeFallback)).toEqual([false]);
});
