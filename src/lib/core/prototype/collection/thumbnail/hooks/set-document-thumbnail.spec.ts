import { describe, expect, it } from 'vitest';
import { setDocumentThumbnail } from './set-document-thumbnail.server.js';

const REF = { relationTo: 'medias', documentId: 'm1' };

/** A read of `doc`, a page whose cover is its thumbnail; `medias` answers findByIds with `found`. */
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
  const calls: { system: boolean }[] = [];
  const api = (system: boolean) => ({
    system: (isSystem = true) => api(isSystem),
    findByIds: async () => {
      calls.push({ system });
      return found;
    }
  });
  const run = setDocumentThumbnail({
    doc,
    config: { type: 'collection', slug: 'pages', asThumbnail: 'cover' },
    event: { locals: { rime: { collection: () => api(false) } } },
    context: { params: { select }, isSystemOperation },
    operation: 'read'
  } as any);
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
    expect(asRime.calls).toEqual([{ system: true }]);

    const asCaller = readPage([]);
    await asCaller.run;
    expect(asCaller.calls).toEqual([{ system: false }]);
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
