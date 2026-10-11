import { group, relation, text } from '#lib/fields/index.js';
import { describe, expect, it, vi } from 'vitest';
import { saveRelations } from './index.server.js';

// Cast: `medias` is only a registered slug in the fixture that declares it.
const image = (relation('image') as any).to('medias');

/** A stored junction row, as `relations.getAll` answers it. */
const stored = (id: string, path: string, documentId: string) => ({
  id,
  path,
  position: 0,
  ownerId: 'p1',
  relationTo: 'medias',
  documentId
});

const adapterWith = (rows: ReturnType<typeof stored>[]) => ({
  relations: {
    getAll: vi.fn(async () => rows),
    deleteFromPaths: vi.fn(async () => true),
    delete: vi.fn(async () => true),
    update: vi.fn(async () => true),
    create: vi.fn(async () => true)
  }
});

const noDiff = { toAdd: [], toDelete: [], toUpdate: [] };

describe('saveRelations', () => {
  it('a save of `image` leaves the rows of `images` alone', async () => {
    const adapter = adapterWith([stored('r1', 'image', 'm1'), stored('r2', 'images', 'm9')]);

    await saveRelations({
      data: { image: ['m2'] },
      configMap: { image } as any,
      incomingPaths: ['image'],
      blocksDiff: noDiff,
      treeDiff: noDiff as any,
      adapter: adapter as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });

    const deleted = adapter.relations.delete.mock.calls.flatMap(([args]: any) => args.relations);
    expect(deleted.map((row: { id: string }) => row.id)).toEqual(['r1']);
    expect(adapter.relations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: [expect.objectContaining({ path: 'image', documentId: 'm2' })]
      })
    );
  });

  const save = (adapter: ReturnType<typeof adapterWith>, data: object, paths: string[]) =>
    saveRelations({
      data,
      configMap: { image } as any,
      incomingPaths: paths,
      blocksDiff: noDiff,
      treeDiff: noDiff as any,
      adapter: adapter as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });

  it('a ref with its row id and a new document updates the row to that document', async () => {
    const adapter = adapterWith([stored('r1', 'image', 'm1')]);
    await save(adapter, { image: [{ id: 'r1', relationTo: 'medias', documentId: 'm2' }] }, [
      'image'
    ]);
    expect(adapter.relations.update).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: [expect.objectContaining({ id: 'r1', documentId: 'm2' })]
      })
    );
    expect(adapter.relations.delete).not.toHaveBeenCalled();
    expect(adapter.relations.create).not.toHaveBeenCalled();
  });

  it('an unchanged bare-id save touches nothing', async () => {
    const adapter = adapterWith([stored('r1', 'image', 'm1')]);
    await save(adapter, { image: ['m1'] }, ['image']);
    expect(adapter.relations.delete).not.toHaveBeenCalled();
    expect(adapter.relations.update).not.toHaveBeenCalled();
    expect(adapter.relations.create).not.toHaveBeenCalled();
  });

  it("a group sent with some of its members keeps the other members' relations", async () => {
    const adapter = adapterWith([stored('r1', 'meta.metaImage', 'm1')]);
    const meta = group('meta').fields(text('metaTitle'));
    await saveRelations({
      data: { meta: { metaTitle: 'Edited' } },
      configMap: { meta, 'meta.metaTitle': text('metaTitle') } as any,
      incomingPaths: ['meta', 'meta.metaTitle'],
      blocksDiff: noDiff,
      treeDiff: noDiff as any,
      adapter: adapter as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });
    expect(adapter.relations.delete).not.toHaveBeenCalled();
  });

  it('deletes the relations under a removed block and under a removed tree item', async () => {
    const adapter = adapterWith([]);
    await saveRelations({
      data: {},
      configMap: {} as any,
      incomingPaths: [],
      blocksDiff: {
        toAdd: [],
        toUpdate: [],
        toDelete: [{ id: 'b1', type: 'image', path: 'layout', position: 2 }]
      } as any,
      treeDiff: {
        toAdd: [],
        toUpdate: [],
        toDelete: [{ id: 't1', path: 'nav.0._children', position: 1 }]
      } as any,
      adapter: adapter as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });
    const deletedPaths = adapter.relations.deleteFromPaths.mock.calls.map(
      ([args]: any) => args.paths
    );
    expect(deletedPaths).toEqual([['layout.2'], ['nav.0._children.1']]);
    expect(adapter.relations.deleteFromPaths).toHaveBeenCalledWith(
      expect.objectContaining({ parentSlug: 'pages', ownerId: 'p1' })
    );
  });
});
