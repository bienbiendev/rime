import { describe, expect, it } from 'vitest';
import { setDocumentThumbnail } from './set-document-thumbnail.server.js';

const REF = { relationTo: 'medias', documentId: 'm1' };

/** A `medias` collection that answers findByIds with `found`, and the calls it got. */
const mediasWith = (found: object[]) => {
  const calls: { system: boolean; ids: string[] }[] = [];
  const api = (system: boolean) => ({
    system: (isSystem = true) => api(isSystem),
    findByIds: async ({ ids }: { ids: string[] }) => {
      calls.push({ system, ids });
      return found;
    }
  });
  return { rime: { collection: () => api(false) }, calls };
};

/** The hook's arguments for `doc`, a page whose cover is its thumbnail. */
const argsFor = (doc: Record<string, unknown>, rime: object, context: object) =>
  ({
    doc,
    config: { type: 'collection', slug: 'pages', asThumbnail: 'cover' },
    event: { locals: { rime } },
    context,
    operation: 'read'
  }) as any;

/** A read of `doc`; `medias` answers findByIds with `found`. */
const read = ({
  doc = { id: 'p1', cover: [REF] },
  found = [],
  isSystemOperation = false,
  select
}: {
  doc?: Record<string, unknown>;
  found?: object[];
  isSystemOperation?: boolean;
  select?: string[];
}) => {
  const { rime, calls } = mediasWith(found);
  const run = setDocumentThumbnail(argsFor(doc, rime, { params: { select }, isSystemOperation }));
  return { run, calls };
};

/** A read of a page whose cover points at a media. */
const readPage = (found: object[], isSystemOperation = false) => read({ found, isSystemOperation });

describe('setDocumentThumbnail', () => {
  it('takes the thumbnail of a media the reader may read', async () => {
    const { run } = readPage([{ id: 'm1', _thumbnail: '/medias/m1.jpg' }]);
    expect((await run).doc._thumbnail).toBe('/medias/m1.jpg');
  });

  it('leaves the thumbnail out, and keeps the document, when the media is refused', async () => {
    const { run } = readPage([]);
    const { doc } = await run;
    expect(doc.id).toBe('p1');
    expect(doc._thumbnail).toBeUndefined();
  });

  it('reads the media as the read runs', async () => {
    const asRime = readPage([], true);
    await asRime.run;
    expect(asRime.calls).toEqual([{ system: true, ids: ['m1'] }]);

    const asCaller = readPage([]);
    await asCaller.run;
    expect(asCaller.calls).toEqual([{ system: false, ids: ['m1'] }]);
  });

  it('reads the media of a whole list once, each document taking its own', async () => {
    const { rime, calls } = mediasWith([
      { id: 'm1', _thumbnail: '/medias/m1.jpg' },
      { id: 'm2', _thumbnail: '/medias/m2.jpg' }
    ]);
    const docs = [
      { id: 'p1', cover: [REF] },
      { id: 'p2', cover: [{ relationTo: 'medias', documentId: 'm2' }] }
    ];
    const context = { params: {}, list: { docs, reads: new Map() } };
    const [p1, p2] = await Promise.all(
      docs.map((doc) => setDocumentThumbnail(argsFor(doc, rime, context)))
    );
    expect(calls).toEqual([{ system: false, ids: ['m1', 'm2'] }]);
    expect(p1.doc._thumbnail).toBe('/medias/m1.jpg');
    expect(p2.doc._thumbnail).toBe('/medias/m2.jpg');
  });

  it('reads no media for a select without `_thumbnail`', async () => {
    const media = [{ id: 'm1', _thumbnail: '/medias/m1.jpg' }];

    const without = read({ found: media, select: ['title'] });
    expect((await without.run).doc._thumbnail).toBeUndefined();
    expect(without.calls).toEqual([]);

    const withThumbnail = read({ found: media, select: ['title', '_thumbnail'] });
    expect((await withThumbnail.run).doc._thumbnail).toBe('/medias/m1.jpg');
    expect(withThumbnail.calls).toHaveLength(1);
  });

  it('takes the thumbnail of a cover read at depth 1, without reading it again', async () => {
    const { run, calls } = read({
      doc: { id: 'p1', cover: [{ id: 'm1', _thumbnail: '/medias/m1-sm.jpg' }] }
    });
    expect((await run).doc._thumbnail).toBe('/medias/m1-sm.jpg');
    expect(calls).toEqual([]);
  });

  it('keeps a `_thumbnail` the document already carries', async () => {
    const { run, calls } = read({
      doc: { id: 'p1', cover: [REF], _thumbnail: '/own.jpg' },
      found: [{ id: 'm1', _thumbnail: '/medias/m1.jpg' }]
    });
    expect((await run).doc._thumbnail).toBe('/own.jpg');
    expect(calls).toEqual([]);
  });
});
