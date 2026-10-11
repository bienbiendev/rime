import { block, blocks } from '#lib/fields/blocks/index.js';
import { checkbox } from '#lib/fields/checkbox/index.js';
import { group } from '#lib/fields/group/index.js';
import { select } from '#lib/fields/select/index.js';
import { text } from '#lib/fields/text/index.js';
import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { copyLocales } from './copy.server.js';

const fields = [
  group('attributes').fields(checkbox('isHome')),
  // Fields named like the metas of a row
  group('event').fields(text('ownerId').localized(), text('createdAt').localized()),
  text('title').localized(),
  select('tags').options('a', 'b').many().localized(),
  blocks('sections', [
    block('paragraph').fields(text('text').localized()),
    block('image').fields(text('caption').localized())
  ]),
  blocks('notes', [
    block('note').fields(text('text')),
    block('grid').fields(blocks('items', [block('note').fields(text('text'))]))
  ]).localized()
];

/**
 * Copies `fr` from `source` onto `target`, through a rime that reads `source` and records what is
 * written. Answers the data written.
 */
const copyFr = async (source: Dic, target: Dic) => {
  const writes: Dic[] = [];
  const api = {
    findById: async () => structuredClone(source),
    updateById: async (args: Dic) => writes.push(args.data)
  };
  const rime = { collection: () => ({ system: () => api }) };
  await copyLocales({
    event: { locals: { rime } } as any,
    config: { type: 'collection', slug: 'pages', fields } as any,
    source: { id: 'doc', versionId: 'v1' },
    target: { id: 'doc', versionId: 'v2', doc: target as any },
    locales: ['fr']
  });
  expect(writes).toHaveLength(1);
  return writes[0];
};

const paragraph = (id: string, text: string) => ({ id, type: 'paragraph', text });
const image = (id: string, caption: string) => ({ id, type: 'image', caption });

describe('copyLocales', () => {
  it("names each locale on its reads and writes, and leaves the request's locale alone", async () => {
    const calls: Dic[] = [];
    const api = {
      findById: async (args: Dic) => {
        calls.push(args);
        return { id: 'doc', title: 'Bonjour' };
      },
      updateById: async (args: Dic) => calls.push(args)
    };
    const setLocale = vi.fn();
    const rime = { setLocale, collection: () => ({ system: () => api }) };
    await copyLocales({
      event: { locals: { rime } } as any,
      config: { type: 'collection', slug: 'pages', fields } as any,
      source: { id: 'doc' },
      target: { id: 'copy', doc: { id: 'copy', title: 'Hello' } as any },
      locales: ['fr', 'de']
    });

    expect(calls.map((call) => call.locale)).toEqual(['fr', 'fr', 'de', 'de']);
    expect(setLocale).not.toHaveBeenCalled();
  });

  it('keeps the target value of a field every locale shares', async () => {
    const written = await copyFr(
      { id: 'doc', attributes: { isHome: false }, title: 'Bonjour', sections: [] },
      { id: 'doc', attributes: { isHome: true }, title: 'Hello', sections: [] }
    );

    expect(written.attributes).toEqual({ isHome: true });
    expect(written.title).toBe('Bonjour');
  });

  it('keeps the target rows of a shared list, and their ids, after a reorder', async () => {
    const written = await copyFr(
      { id: 'doc', title: 'Bonjour', sections: [paragraph('p1', 'FR p'), image('i1', 'FR i')] },
      { id: 'doc', title: 'Hello', sections: [image('i2', 'EN i'), paragraph('p2', 'EN p')] }
    );

    expect(written.sections).toEqual([
      { id: 'i2', type: 'image', caption: null },
      { id: 'p2', type: 'paragraph', text: null }
    ]);
  });

  it('gives a shared row the localized values of the source row at its index when the types match', async () => {
    const written = await copyFr(
      { id: 'doc', title: 'Bonjour', sections: [paragraph('p1', 'FR p'), image('i1', 'FR i')] },
      { id: 'doc', title: 'Hello', sections: [paragraph('p2', 'EN p'), paragraph('p3', 'EN q')] }
    );

    expect(written.sections).toEqual([
      { id: 'p2', type: 'paragraph', text: 'FR p' },
      { id: 'p3', type: 'paragraph', text: null }
    ]);
  });

  it('copies a localized list whole without row ids at any depth, and a list of values as it is', async () => {
    const written = await copyFr(
      {
        id: 'doc',
        title: 'Bonjour',
        tags: ['a', 'b'],
        sections: [],
        notes: [
          { id: 'g1', type: 'grid', items: [{ id: 'n1', type: 'note', text: 'FR' }] },
          { id: 'n2', type: 'note', text: 'FR 2' }
        ]
      },
      { id: 'doc', title: 'Hello', tags: ['a'], sections: [], notes: [] }
    );

    expect(written.tags).toEqual(['a', 'b']);
    expect(written.notes).toEqual([
      { type: 'grid', items: [{ type: 'note', text: 'FR' }] },
      { type: 'note', text: 'FR 2' }
    ]);
  });

  it("drops the document's metas and a row's owner, and keeps a field named like them", async () => {
    const written = await copyFr(
      {
        id: 'doc',
        ownerId: 'doc',
        createdAt: 'yesterday',
        title: 'Bonjour',
        event: { ownerId: 'Marie', createdAt: 'lundi' },
        sections: [{ ...paragraph('p1', 'FR p'), ownerId: 'v1' }]
      },
      {
        id: 'doc',
        ownerId: 'doc',
        createdAt: 'today',
        title: 'Hello',
        event: { ownerId: 'Mary', createdAt: 'Monday' },
        sections: [{ ...paragraph('p2', 'EN p'), ownerId: 'v2' }]
      }
    );

    expect(written).not.toHaveProperty('ownerId');
    expect(written).not.toHaveProperty('createdAt');
    expect(written.event).toEqual({ ownerId: 'Marie', createdAt: 'lundi' });
    expect(written.sections).toEqual([{ id: 'p2', type: 'paragraph', text: 'FR p' }]);
  });
});
