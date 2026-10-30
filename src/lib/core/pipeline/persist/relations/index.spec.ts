import { block, blocks, group, relation, text, tree } from '#lib/fields/index.js';
import { describe, expect, it, vi } from 'vitest';
import { saveRelations } from './index.server.js';

// Cast: `medias` is only a registered slug in the fixture that declares it.
const imageField = () => (relation('image') as any).to('medias');
const image = imageField();

/** A stored junction row, as `relations.getAll` answers it. */
const stored = (id: string, path: string, documentId: string, locale: string | null = null) => ({
  id,
  path,
  position: 0,
  ownerId: 'p1',
  relationTo: 'medias',
  documentId,
  locale
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

const noDiff = { toAdd: [], toDelete: [], toUpdate: [], moved: [] };

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
        ...noDiff,
        toDelete: [{ id: 'b1', type: 'image', path: 'layout', position: 2 }]
      } as any,
      treeDiff: {
        ...noDiff,
        toDelete: [{ id: 't1', path: 'nav.0._children', position: 1 }]
      } as any,
      adapter: adapter as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });
    const deletedPaths = adapter.relations.deleteFromPaths.mock.calls.flatMap(
      ([args]: any) => args.paths
    );
    expect(deletedPaths).toEqual(['layout.2', 'nav.0._children.1']);
    expect(adapter.relations.deleteFromPaths).toHaveBeenCalledWith(
      expect.objectContaining({ parentSlug: 'pages', ownerId: 'p1' })
    );
  });

  /** The `deleteFromPaths` calls that delete something, as `{ paths, locale }`. */
  const deletions = (adapter: ReturnType<typeof adapterWith>) =>
    adapter.relations.deleteFromPaths.mock.calls
      .map(([args]: any) => ({ paths: args.paths, locale: args.locale }))
      .filter((args) => args.paths.length);

  const removeRow = async (configMap: object, removed: object, diff: 'blocksDiff' | 'treeDiff') => {
    const adapter = adapterWith([]);
    await saveRelations({
      data: {},
      configMap: configMap as any,
      incomingPaths: [],
      blocksDiff: noDiff,
      treeDiff: noDiff as any,
      [diff]: { ...noDiff, toDelete: [removed] },
      adapter: adapter as any,
      locale: 'en',
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });
    return deletions(adapter);
  };

  it('a removed block of a shared list takes its relations in every locale', async () => {
    const sections = blocks('sections', [block('hero').fields(imageField().localized())]);
    const removed = { id: 'b2', type: 'hero', path: 'sections', position: 1 };
    expect(await removeRow({ sections }, removed, 'blocksDiff')).toEqual([
      { paths: ['sections.1'], locale: undefined }
    ]);
  });

  it('a removed block of a localized list takes its relations in the request locale', async () => {
    const sections = blocks('sections', [block('hero').fields(imageField())]).localized();
    const removed = { id: 'b2', type: 'hero', path: 'sections', position: 1 };
    expect(await removeRow({ sections }, removed, 'blocksDiff')).toEqual([
      { paths: ['sections.1'], locale: 'en' }
    ]);
  });

  it('a removed child item of a shared tree takes its relations in every locale', async () => {
    const menu = tree('menu').fields(imageField().localized());
    const removed = { id: 't2', path: 'menu.0._children', position: 1 };
    expect(await removeRow({ menu }, removed, 'treeDiff')).toEqual([
      { paths: ['menu.0._children.1'], locale: undefined }
    ]);
  });

  it("a moved block of a shared list moves the other locales' relations under it", async () => {
    const sections = blocks('sections', [block('hero').fields(imageField().localized())]);
    const adapter = adapterWith([
      stored('r9', 'sections.2.image', 'f3', 'fr'),
      stored('r8', 'sections.2.image', 'm3', 'en'),
      stored('r7', 'sections.2.image', 'm7')
    ]);
    await saveRelations({
      data: {},
      configMap: { sections } as any,
      incomingPaths: [],
      blocksDiff: {
        ...noDiff,
        moved: [{ path: 'sections', from: 'sections.2', to: 'sections.1' }]
      },
      treeDiff: noDiff as any,
      adapter: adapter as any,
      locale: 'en',
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });
    expect(adapter.relations.update).toHaveBeenCalledTimes(1);
    expect(adapter.relations.update).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: [expect.objectContaining({ id: 'r9', path: 'sections.1.image' })]
      })
    );
  });

  it("a moved block of a localized list leaves the other locales' relations", async () => {
    const sections = blocks('sections', [block('hero').fields(imageField())]).localized();
    const adapter = adapterWith([stored('r9', 'sections.2.image', 'f3', 'fr')]);
    await saveRelations({
      data: {},
      configMap: { sections } as any,
      incomingPaths: [],
      blocksDiff: {
        ...noDiff,
        moved: [{ path: 'sections', from: 'sections.2', to: 'sections.1' }]
      },
      treeDiff: noDiff as any,
      adapter: adapter as any,
      locale: 'en',
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });
    expect(adapter.relations.update).not.toHaveBeenCalled();
  });
});
